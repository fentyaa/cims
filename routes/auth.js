/**
 * Auth Routes
 * 
 * Semua route yang berkaitan dengan autentikasi:
 * - Registrasi
 * - Login/Logout
 * - Lupa/Reset Password
 * - Approval Akun (Mentor)
 * - Dashboard Mentor & Intern
 */

import { Router } from "express";
import {
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
} from "../controllers/authController.js";

import {
  isAuthenticated,
  mentorOnly,
  redirectIfAuthenticated,
} from "../middlewares/authMiddleware.js";
import { upload, handleUploadError } from "../middlewares/upload.js";
import { csrfProtection } from "../middlewares/csrf.js";

const router = Router();

// ============================================================
// REGISTRASI (hanya untuk INTERN)
// ============================================================

router.get("/register", redirectIfAuthenticated, showRegisterForm);
router.post("/register", redirectIfAuthenticated, upload.single("profilePhoto"), handleUploadError, csrfProtection, register);

// ============================================================
// LOGIN
// ============================================================

router.get("/login", redirectIfAuthenticated, showLoginForm);
router.post("/login", redirectIfAuthenticated, login);

// ============================================================
// LOGOUT
// ============================================================

router.get("/logout", isAuthenticated, logout);

// ============================================================
// FORGOT PASSWORD
// ============================================================

router.get("/forgot-password", redirectIfAuthenticated, showForgotPasswordForm);
router.post("/forgot-password", redirectIfAuthenticated, forgotPassword);

// ============================================================
// RESET PASSWORD (dengan token)
// ============================================================

router.get("/reset-password/:token", redirectIfAuthenticated, showResetPasswordForm);
router.post("/reset-password/:token", redirectIfAuthenticated, resetPassword);

// ============================================================
// APPROVAL AKUN (MENTOR ONLY)
// ============================================================

router.get("/approval", isAuthenticated, mentorOnly, showApprovalPage);
router.post("/approve/:userId", isAuthenticated, mentorOnly, approveAccount);
router.post("/reject/:userId", isAuthenticated, mentorOnly, rejectAccount);

export default router;

