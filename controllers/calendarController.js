/**
 * Calendar Controller
 *
 * Mengelola request tampilan Kalender Magang untuk:
 * - Intern: hanya kalender miliknya sendiri (scoping via session.user.id)
 * - Mentor: kalender peserta magang dengan pemilih peserta
 */

import prisma from "../config/database.js";
import calendarService from "../services/calendarService.js";

/**
 * Menampilkan halaman Kalender Magang untuk Peserta (Intern).
 */
export const internCalendarPage = async (req, res) => {
  try {
    // WAJIB menggunakan userId dari session untuk mencegah IDOR
    const userId = req.session.user.id;
    const { year, month } = req.query;

    const calendarData = await calendarService.getInternCalendarData(userId, year, month);

    res.render("pages/intern/kalender", {
      title: "Kalender Magang - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      calendarData,
      messages: req.session.messages || [],
    });

    req.session.messages = [];
  } catch (error) {
    console.error("Intern calendar page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat kalender magang." },
    ];
    return res.redirect("/intern/dashboard");
  }
};

/**
 * Menampilkan halaman Kalender Magang untuk Mentor (dengan pemilih peserta).
 */
export const mentorCalendarPage = async (req, res) => {
  try {
    const { year, month, userId: queryUserId } = req.query;

    // Ambil daftar seluruh peserta aktif
    const participants = await prisma.user.findMany({
      where: { role: "INTERN", status: "ACTIVE" },
      select: {
        id: true,
        fullName: true,
        participantType: true,
        university: true,
        schoolName: true,
        internshipPeriod: true,
        internshipStartDate: true,
        internshipEndDate: true,
      },
      orderBy: { fullName: "asc" },
    });

    if (participants.length === 0) {
      return res.render("pages/mentor/kalender", {
        title: "Kalender Magang Peserta - Internship Management System",
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        participants: [],
        selectedUserId: null,
        calendarData: null,
        messages: req.session.messages || [],
      });
    }

    // Tentukan peserta yang dipilih (default peserta pertama jika tidak dispesifikasikan)
    let selectedUserId = queryUserId;
    const isValidParticipant = participants.some((p) => p.id === selectedUserId);
    if (!selectedUserId || !isValidParticipant) {
      selectedUserId = participants[0].id;
    }

    const calendarData = await calendarService.getInternCalendarData(selectedUserId, year, month);

    res.render("pages/mentor/kalender", {
      title: `Kalender Magang - ${calendarData.user.fullName} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participants,
      selectedUserId,
      calendarData,
      messages: req.session.messages || [],
    });

    req.session.messages = [];
  } catch (error) {
    console.error("Mentor calendar page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat kalender peserta." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

export default {
  internCalendarPage,
  mentorCalendarPage,
};
