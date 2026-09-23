/**
 * Auth Controller
 * 
 * Menangani semua proses autentikasi:
 * - Registrasi (Sign Up)
 * - Login
 * - Logout
 * - Forgot Password
 * - Reset Password
 * - Approval akun (Mentor)
 */

import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../config/database.js";
import { sendEmail } from "../config/mailer.js";
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} from "../utils/validators.js";
import { regenerateCsrfToken } from "../middlewares/csrf.js";
import { formatInternshipPeriod } from "../utils/helpers.js";

const SALT_ROUNDS = 10;

// ============================================================
// REGISTRASI (SIGN UP)
// ============================================================

/**
 * Menampilkan halaman registrasi.
 */
export const showRegisterForm = (req, res) => {
  res.render("pages/auth/register", {
    title: "Daftar Akun - Internship Management System",
    layout: "layouts/main",
    formData: {},
    errors: [],
  });
};

/**
 * Proses registrasi peserta magang.
 */
export const register = async (req, res) => {
  try {
    // Safety check: req.body could be undefined if no body parser matched
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).render("pages/auth/register", {
        title: "Daftar Akun - Internship Management System",
        layout: "layouts/main",
        formData: {},
        errors: ["Data form tidak valid. Silakan coba lagi."],
      });
    }

    const formData = {
      fullName: req.body.fullName?.trim(),
      email: req.body.email?.trim().toLowerCase(),
      phoneNumber: req.body.phoneNumber?.trim(),
      participantType: req.body.participantType,
      university: req.body.university?.trim(),
      studyProgram: req.body.studyProgram?.trim(),
      studentId: req.body.studentId?.trim(),
      schoolName: req.body.schoolName?.trim(),
      major: req.body.major?.trim(),
      classGrade: req.body.classGrade?.trim(),
      internshipPeriod: req.body.internshipPeriod?.trim(),
      internshipStartDate: req.body.internshipStartDate ? req.body.internshipStartDate.trim() : null,
      internshipEndDate: req.body.internshipEndDate ? req.body.internshipEndDate.trim() : null,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
    };

    // Validasi input
    const validation = validateRegister(formData);
    if (!validation.valid) {
      return res.render("pages/auth/register", {
        title: "Daftar Akun - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: validation.errors,
      });
    }

    // Cek email sudah terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { email: formData.email },
      select: { id: true },
    });

    if (existingUser) {
      return res.render("pages/auth/register", {
        title: "Daftar Akun - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: ["Email sudah terdaftar. Gunakan email lain."],
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(formData.password, SALT_ROUNDS);

    // Dapatkan atau turunkan keterangan periode dari tanggal mulai & selesai
    let computedPeriod = formData.internshipPeriod ? formData.internshipPeriod.trim() : "";
    if (formData.internshipStartDate && formData.internshipEndDate) {
      computedPeriod = formatInternshipPeriod(formData.internshipStartDate, formData.internshipEndDate) || computedPeriod;
    }

    // Data untuk disimpan ke database
    const userData = {
      fullName: formData.fullName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      password: hashedPassword,
      role: "INTERN",
      participantType: formData.participantType,
      status: "PENDING",
      internshipPeriod: computedPeriod || "-",
      internshipStartDate: formData.internshipStartDate ? new Date(formData.internshipStartDate) : null,
      internshipEndDate: formData.internshipEndDate ? new Date(formData.internshipEndDate) : null,
    };

    // Field khusus participant type
    if (formData.participantType === "UNIVERSITY") {
      userData.university = formData.university;
      userData.studyProgram = formData.studyProgram;
      userData.studentId = formData.studentId;
    } else if (formData.participantType === "SMK") {
      userData.schoolName = formData.schoolName;
      userData.major = formData.major;
      userData.classGrade = formData.classGrade;
    }

    // Simpan foto profil jika diupload
    if (req.file) {
      userData.profilePhoto = req.file.filename;
    }

    // Simpan ke database
    const user = await prisma.user.create({ data: userData });

    // Simpan pesan sukses ke session
    req.session.messages = [
      {
        type: "success",
        text: "Pendaftaran berhasil! Akun Anda sedang menunggu persetujuan mentor. Silakan cek email untuk notifikasi.",
      },
    ];

    return res.redirect("/auth/login");
  } catch (error) {
    console.error("Register error:", error);
    return res.render("pages/auth/register", {
      title: "Daftar Akun - Internship Management System",
      layout: "layouts/main",
      formData: req.body,
      errors: ["Terjadi kesalahan server. Silakan coba lagi."],
    });
  }
};

// ============================================================
// LOGIN
// ============================================================

/**
 * Menampilkan halaman login.
 */
export const showLoginForm = (req, res) => {
  res.render("pages/auth/login", {
    title: "Masuk - Internship Management System",
    layout: "layouts/main",
    formData: {},
    errors: [],
  });
};

/**
 * Proses login.
 */
export const login = async (req, res) => {
  try {
    const formData = {
      email: req.body.email?.trim().toLowerCase(),
      password: req.body.password,
    };

    // Validasi input
    const validation = validateLogin(formData);
    if (!validation.valid) {
      return res.render("pages/auth/login", {
        title: "Masuk - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: validation.errors,
      });
    }

    // Cari user berdasarkan email (proyeksi field yang dibutuhkan saja)
    const user = await prisma.user.findUnique({
      where: { email: formData.email },
      select: {
        id: true,
        fullName: true,
        email: true,
        password: true,
        role: true,
        participantType: true,
        status: true,
      },
    });

    if (!user) {
      return res.render("pages/auth/login", {
        title: "Masuk - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: ["Email atau password salah."],
      });
    }

    // Verifikasi password
    const isPasswordValid = await bcrypt.compare(formData.password, user.password);
    if (!isPasswordValid) {
      return res.render("pages/auth/login", {
        title: "Masuk - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: ["Email atau password salah."],
      });
    }

    // Cek status akun
    if (user.status === "PENDING") {
      return res.render("pages/auth/login", {
        title: "Masuk - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: ["Akun Anda masih menunggu persetujuan mentor."],
      });
    }

    if (user.status === "REJECTED") {
      return res.render("pages/auth/login", {
        title: "Masuk - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: ["Akun Anda ditolak. Silakan hubungi mentor untuk informasi lebih lanjut."],
      });
    }

    if (user.status === "ARCHIVED") {
      return res.render("pages/auth/login", {
        title: "Masuk - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: ["Akun Anda sudah tidak aktif."],
      });
    }

    // Login berhasil - simpan ke session
    req.session.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      participantType: user.participantType || null,
    };

    // Regenerasi token CSRF setelah login berhasil
    regenerateCsrfToken(req);

    // Redirect sesuai role
    const redirectPath =
      user.role === "MENTOR" ? "/mentor/dashboard" : "/intern/dashboard";

    return res.redirect(redirectPath);
  } catch (error) {
    console.error("Login error:", error);
    return res.render("pages/auth/login", {
      title: "Masuk - Internship Management System",
      layout: "layouts/main",
      formData: req.body,
      errors: ["Terjadi kesalahan server. Silakan coba lagi."],
    });
  }
};

// ============================================================
// LOGOUT
// ============================================================

/**
 * Proses logout - menghancurkan session.
 */
export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.clearCookie("cims.sid");
    res.clearCookie("connect.sid");
    return res.redirect("/auth/login");
  });
};

// ============================================================
// FORGOT PASSWORD
// ============================================================

/**
 * Menampilkan halaman lupa password.
 */
export const showForgotPasswordForm = (req, res) => {
  res.render("pages/auth/forgot-password", {
    title: "Lupa Password - Internship Management System",
    layout: "layouts/main",
    formData: {},
    errors: [],
    success: false,
  });
};

/**
 * Proses forgot password.
 * (Email belum dikirim, hanya struktur. Akan diimplementasikan di tahap berikutnya.)
 */
export const forgotPassword = async (req, res) => {
  try {
    const formData = {
      email: req.body.email?.trim().toLowerCase(),
    };

    const validation = validateForgotPassword(formData);
    if (!validation.valid) {
      return res.render("pages/auth/forgot-password", {
        title: "Lupa Password - Internship Management System",
        layout: "layouts/main",
        formData,
        errors: validation.errors,
        success: false,
      });
    }

    // Cari user berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email: formData.email },
    });

    // Selalu tampilkan pesan sukses untuk keamanan (tidak mengungkap apakah email terdaftar)
    if (!user) {
      return res.render("pages/auth/forgot-password", {
        title: "Lupa Password - Internship Management System",
        layout: "layouts/main",
        formData: {},
        errors: [],
        success: true,
      });
    }

    // Generate token reset password
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    // Simpan token ke database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    // Buat link reset password
    const resetUrl = `${req.protocol}://${req.get("host")}/auth/reset-password/${resetToken}`;

    // Kirim email reset password
    try {
      await sendEmail({
        to: user.email,
        subject: "Reset Password - Internship Management System",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a365d;">Reset Password</h2>
            <p>Hai ${user.fullName},</p>
            <p>Kami menerima permintaan reset password untuk akun Anda.</p>
            <p>Klik tombol di bawah ini untuk mereset password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p>Link ini akan kedaluwarsa dalam 1 jam.</p>
            <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #718096; font-size: 12px;">
              &copy; ${new Date().getFullYear()} Internship Management System
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError.message);
      // Tetap lanjutkan, token sudah tersimpan
    }

    return res.render("pages/auth/forgot-password", {
      title: "Lupa Password - Internship Management System",
      layout: "layouts/main",
      formData: {},
      errors: [],
      success: true,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.render("pages/auth/forgot-password", {
      title: "Lupa Password - Internship Management System",
      layout: "layouts/main",
      formData: req.body,
      errors: ["Terjadi kesalahan server. Silakan coba lagi."],
      success: false,
    });
  }
};

// ============================================================
// RESET PASSWORD
// ============================================================

/**
 * Menampilkan halaman reset password (via token).
 */
export const showResetPasswordForm = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      req.session.messages = [
        { type: "danger", text: "Token reset password tidak valid." },
      ];
      return res.redirect("/auth/login");
    }

    // Cari user berdasarkan token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gte: new Date() },
      },
    });

    if (!user) {
      req.session.messages = [
        {
          type: "danger",
          text: "Token reset password tidak valid atau sudah kedaluwarsa.",
        },
      ];
      return res.redirect("/auth/login");
    }

    res.render("pages/auth/reset-password", {
      title: "Reset Password - Internship Management System",
      layout: "layouts/main",
      token,
      errors: [],
    });
  } catch (error) {
    console.error("Show reset password error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan server." },
    ];
    return res.redirect("/auth/login");
  }
};

/**
 * Proses reset password.
 */
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const formData = {
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
    };

    if (!token) {
      req.session.messages = [
        { type: "danger", text: "Token reset password tidak valid." },
      ];
      return res.redirect("/auth/login");
    }

    // Validasi input
    const validation = validateResetPassword(formData);
    if (!validation.valid) {
      return res.render("pages/auth/reset-password", {
        title: "Reset Password - Internship Management System",
        layout: "layouts/main",
        token,
        errors: validation.errors,
      });
    }

    // Cari user berdasarkan token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gte: new Date() },
      },
    });

    if (!user) {
      req.session.messages = [
        {
          type: "danger",
          text: "Token reset password tidak valid atau sudah kedaluwarsa.",
        },
      ];
      return res.redirect("/auth/login");
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(formData.password, SALT_ROUNDS);

    // Update password dan hapus token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    req.session.messages = [
      {
        type: "success",
        text: "Password berhasil diubah. Silakan login dengan password baru.",
      },
    ];

    return res.redirect("/auth/login");
  } catch (error) {
    console.error("Reset password error:", error);
    return res.render("pages/auth/reset-password", {
      title: "Reset Password - Internship Management System",
      layout: "layouts/main",
      token: req.params.token,
      errors: ["Terjadi kesalahan server. Silakan coba lagi."],
    });
  }
};

// ============================================================
// APPROVAL AKUN (MENTOR ONLY)
// ============================================================

/**
 * Menampilkan daftar akun yang perlu di-approve.
 */
export const showApprovalPage = async (req, res) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { status: "PENDING", role: "INTERN" },
      orderBy: { createdAt: "desc" },
    });

    const approvedUsers = await prisma.user.findMany({
      where: { status: "ACTIVE", role: "INTERN" },
      orderBy: { updatedAt: "desc" },
    });

    const rejectedUsers = await prisma.user.findMany({
      where: { status: "REJECTED", role: "INTERN" },
      orderBy: { updatedAt: "desc" },
    });

    res.render("pages/auth/approval", {
      title: "Persetujuan Akun - Internship Management System",
      layout: "layouts/main",
      pendingUsers,
      approvedUsers,
      rejectedUsers,
    });
  } catch (error) {
    console.error("Approval page error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

/**
 * Proses approve akun.
 */
export const approveAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      req.session.messages = [
        { type: "danger", text: "Akun tidak ditemukan." },
      ];
      return res.redirect("/auth/approval");
    }

    if (user.role !== "INTERN") {
      req.session.messages = [
        { type: "danger", text: "Hanya akun peserta magang yang dapat di-approve." },
      ];
      return res.redirect("/auth/approval");
    }

    // Otomatis sambungkan ke mentor tunggal jika belum memiliki mentorId
    let mentorId = user.mentorId;
    if (!mentorId) {
      const defaultMentor = await prisma.user.findFirst({
        where: { role: "MENTOR" },
        select: { id: true },
      });
      if (defaultMentor) mentorId = defaultMentor.id;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
        ...(mentorId ? { mentorId } : {}),
      },
    });

    req.session.messages = [
      {
        type: "success",
        text: `Akun ${user.fullName} berhasil di-approve.`,
      },
    ];

    return res.redirect("/auth/approval");
  } catch (error) {
    console.error("Approve error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan server." },
    ];
    return res.redirect("/auth/approval");
  }
};

/**
 * Proses reject akun.
 */
export const rejectAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      req.session.messages = [
        { type: "danger", text: "Akun tidak ditemukan." },
      ];
      return res.redirect("/auth/approval");
    }

    if (user.role !== "INTERN") {
      req.session.messages = [
        { type: "danger", text: "Hanya akun peserta magang yang dapat di-reject." },
      ];
      return res.redirect("/auth/approval");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: "REJECTED" },
    });

    req.session.messages = [
      {
        type: "warning",
        text: `Akun ${user.fullName} telah di-reject.`,
      },
    ];

    return res.redirect("/auth/approval");
  } catch (error) {
    console.error("Reject error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan server." },
    ];
    return res.redirect("/auth/approval");
  }
};

export default {
  showRegisterForm,
  register,
  showLoginForm,
  login,
  logout,
  showForgotPasswordForm,
  forgotPassword,
  showResetPasswordForm,
  resetPassword,
  showApprovalPage,
  approveAccount,
  rejectAccount,
};

