/**
 * Evaluation Controller
 *
 * Menangani semua request terkait Penilaian Peserta:
 * - Mentor: list, create, edit, detail, publish, archive
 * - Intern: view own evaluation
 */

import prisma from "../config/database.js";
import evaluationService from "../services/evaluationService.js";
import { validateEvaluation, parseEvaluationScore } from "../utils/validators.js";

// ============================================================
// MENTOR: HALAMAN DAFTAR PENILAIAN
// ============================================================

/**
 * Menampilkan daftar penilaian peserta (Mentor).
 */
export const mentorList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const type = req.query.type || "";
    const status = req.query.status || "";

    const result = await evaluationService.getEvaluations({
      page,
      limit,
      search,
      type,
      status,
    });

    res.render("pages/mentor/penilaian", {
      title: "Penilaian Peserta - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      evaluations: result.data,
      pagination: result.pagination,
      filters: { search, type, status },
    });
  } catch (error) {
    console.error("Mentor evaluation list error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data penilaian." },
    ];
    return res.redirect("/mentor/dashboard");
  }
};

// ============================================================
// MENTOR: BUAT PENILAIAN
// ============================================================

/**
 * Menampilkan halaman form pembuatan penilaian.
 */
export const mentorCreateForm = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validasi peserta
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "INTERN") {
      req.session.messages = [
        { type: "danger", text: "Peserta tidak ditemukan." },
      ];
      return res.redirect("/mentor/penilaian");
    }

    // Cek apakah sudah ada evaluasi
    const existing = await evaluationService.getEvaluationByUserId(userId);
    if (existing) {
      req.session.messages = [
        { type: "warning", text: `Peserta ${user.fullName} sudah memiliki penilaian. Silakan edit penilaian yang sudah ada.` },
      ];
      return res.redirect(`/mentor/penilaian/edit/${existing.id}`);
    }

    res.render("pages/mentor/penilaian-buat", {
      title: `Buat Penilaian - ${user.fullName} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      participant: user,
      formData: {},
      errors: [],
    });
  } catch (error) {
    console.error("Mentor create form error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat form penilaian." },
    ];
    return res.redirect("/mentor/penilaian");
  }
};

/**
 * Proses pembuatan penilaian baru.
 */
export const mentorCreate = async (req, res) => {
  try {
    const { userId } = req.params;
    const mentorId = req.session.user.id;

    // Preservasi input asli dari form untuk re-render jika terjadi kesalahan validasi
    const formInput = {
      userId,
      discipline: req.body.discipline,
      responsibility: req.body.responsibility,
      communication: req.body.communication,
      teamwork: req.body.teamwork,
      initiative: req.body.initiative,
      technicalSkill: req.body.technicalSkill,
      mentorComment: req.body.mentorComment?.trim() || "",
      recommendation: req.body.recommendation?.trim() || "",
    };

    // Validasi input asli mentor
    const validation = validateEvaluation(formInput);
    if (!validation.valid) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return res.render("pages/mentor/penilaian-buat", {
        title: `Buat Penilaian - ${user.fullName} - Internship Management System`,
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        participant: user,
        formData: formInput,
        errors: validation.errors,
      });
    }

    const evaluationData = {
      userId,
      discipline: parseEvaluationScore(req.body.discipline),
      responsibility: parseEvaluationScore(req.body.responsibility),
      communication: parseEvaluationScore(req.body.communication),
      teamwork: parseEvaluationScore(req.body.teamwork),
      initiative: parseEvaluationScore(req.body.initiative),
      technicalSkill: parseEvaluationScore(req.body.technicalSkill),
      mentorComment: req.body.mentorComment?.trim(),
      recommendation: req.body.recommendation?.trim(),
    };

    await evaluationService.createEvaluation(evaluationData, mentorId);

    req.session.messages = [
      { type: "success", text: "Penilaian berhasil dibuat (status: Draft)." },
    ];

    return res.redirect("/mentor/penilaian");
  } catch (error) {
    console.error("Mentor create evaluation error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan server." },
    ];
    return res.redirect("/mentor/penilaian");
  }
};

// ============================================================
// MENTOR: EDIT PENILAIAN
// ============================================================

/**
 * Menampilkan halaman edit penilaian.
 */
export const mentorEditForm = async (req, res) => {
  try {
    const { id } = req.params;

    const evaluation = await evaluationService.getEvaluationById(id);

    if (!evaluation) {
      req.session.messages = [
        { type: "danger", text: "Penilaian tidak ditemukan." },
      ];
      return res.redirect("/mentor/penilaian");
    }

    if (evaluation.status === "PUBLISHED") {
      req.session.messages = [
        { type: "warning", text: "Penilaian yang sudah dipublikasikan tidak dapat diedit." },
      ];
      return res.redirect(`/mentor/penilaian/${id}`);
    }

    res.render("pages/mentor/penilaian-edit", {
      title: `Edit Penilaian - ${evaluation.user.fullName} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      evaluation,
      formData: evaluation,
      errors: [],
    });
  } catch (error) {
    console.error("Mentor edit form error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat form edit." },
    ];
    return res.redirect("/mentor/penilaian");
  }
};

/**
 * Proses update penilaian.
 */
export const mentorUpdate = async (req, res) => {
  try {
    const { id } = req.params;

    // Preservasi input asli dari form untuk re-render jika terjadi kesalahan validasi
    const formInput = {
      discipline: req.body.discipline,
      responsibility: req.body.responsibility,
      communication: req.body.communication,
      teamwork: req.body.teamwork,
      initiative: req.body.initiative,
      technicalSkill: req.body.technicalSkill,
      mentorComment: req.body.mentorComment?.trim() || "",
      recommendation: req.body.recommendation?.trim() || "",
    };

    // Validasi input asli mentor
    const validation = validateEvaluation(formInput);
    if (!validation.valid) {
      const evaluation = await evaluationService.getEvaluationById(id);
      return res.render("pages/mentor/penilaian-edit", {
        title: `Edit Penilaian - ${evaluation.user.fullName} - Internship Management System`,
        layout: "layouts/dashboard",
        userName: req.session.user.fullName,
        evaluation,
        formData: formInput,
        errors: validation.errors,
      });
    }

    const evaluationData = {
      discipline: parseEvaluationScore(req.body.discipline),
      responsibility: parseEvaluationScore(req.body.responsibility),
      communication: parseEvaluationScore(req.body.communication),
      teamwork: parseEvaluationScore(req.body.teamwork),
      initiative: parseEvaluationScore(req.body.initiative),
      technicalSkill: parseEvaluationScore(req.body.technicalSkill),
      mentorComment: req.body.mentorComment?.trim(),
      recommendation: req.body.recommendation?.trim(),
    };

    await evaluationService.updateEvaluation(id, evaluationData);

    req.session.messages = [
      { type: "success", text: "Penilaian berhasil diperbarui." },
    ];

    return res.redirect("/mentor/penilaian");
  } catch (error) {
    console.error("Mentor update evaluation error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan server." },
    ];
    return res.redirect(`/mentor/penilaian/edit/${req.params.id}`);
  }
};

// ============================================================
// MENTOR: DETAIL PENILAIAN
// ============================================================

/**
 * Menampilkan detail penilaian.
 */
export const mentorDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const evaluation = await evaluationService.getEvaluationById(id);

    if (!evaluation) {
      req.session.messages = [
        { type: "danger", text: "Penilaian tidak ditemukan." },
      ];
      return res.redirect("/mentor/penilaian");
    }

    res.render("pages/mentor/penilaian-detail", {
      title: `Detail Penilaian - ${evaluation.user.fullName} - Internship Management System`,
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      evaluation,
    });
  } catch (error) {
    console.error("Mentor detail error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat detail penilaian." },
    ];
    return res.redirect("/mentor/penilaian");
  }
};

// ============================================================
// MENTOR: PUBLISH / ARCHIVE
// ============================================================

/**
 * Proses publish penilaian.
 */
export const mentorPublish = async (req, res) => {
  try {
    const { id } = req.params;

    await evaluationService.publishEvaluation(id);

    req.session.messages = [
      { type: "success", text: "Penilaian berhasil dipublikasikan." },
    ];

    return res.redirect("/mentor/penilaian");
  } catch (error) {
    console.error("Mentor publish error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan server." },
    ];
    return res.redirect("/mentor/penilaian");
  }
};

/**
 * Proses archive penilaian.
 */
export const mentorArchive = async (req, res) => {
  try {
    const { id } = req.params;

    await evaluationService.archiveEvaluation(id);

    req.session.messages = [
      { type: "success", text: "Penilaian berhasil diarsipkan." },
    ];

    return res.redirect("/mentor/penilaian");
  } catch (error) {
    console.error("Mentor archive error:", error);
    req.session.messages = [
      { type: "danger", text: error.message || "Terjadi kesalahan server." },
    ];
    return res.redirect("/mentor/penilaian");
  }
};

// ============================================================
// INTERN: HALAMAN NILAI
// ============================================================

/**
 * Menampilkan halaman nilai/evaluasi untuk peserta.
 */
export const internNilai = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const evalData = await evaluationService.getInternEvaluation(userId);

    res.render("pages/intern/nilai", {
      title: "Nilai & Evaluasi - Internship Management System",
      layout: "layouts/dashboard",
      userName: req.session.user.fullName,
      evaluation: evalData.evaluation,
      evalMeta: evalData,
    });
  } catch (error) {
    console.error("Intern nilai error:", error);
    req.session.messages = [
      { type: "danger", text: "Terjadi kesalahan saat memuat data nilai." },
    ];
    return res.redirect("/intern/dashboard");
  }
};

export default {
  mentorList,
  mentorCreateForm,
  mentorCreate,
  mentorEditForm,
  mentorUpdate,
  mentorDetail,
  mentorPublish,
  mentorArchive,
  internNilai,
};

