/**
 * Automated Verification Script for Part 3A (Medium Security Fixes)
 */

import { isValidPassword, validateRegister, validateResetPassword, validateLogin } from "./utils/validators.js";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

console.log("==================================================");
console.log("TEST SUITE 1: PASSWORD COMPLEXITY (isValidPassword)");
console.log("==================================================");

// 1. Weak passwords that MUST fail
assert(isValidPassword("12345678") === false, "Reject '12345678' (numbers only)");
assert(isValidPassword("password") === false, "Reject 'password' (lowercase only)");
assert(isValidPassword("PASSWORD") === false, "Reject 'PASSWORD' (uppercase only)");
assert(isValidPassword("abcdefgh") === false, "Reject 'abcdefgh' (lowercase only)");
assert(isValidPassword("Pass1") === false, "Reject 'Pass1' (too short < 8 chars)");
assert(isValidPassword("PassWord") === false, "Reject 'PassWord' (missing number)");
assert(isValidPassword("1234567A") === false, "Reject '1234567A' (missing lowercase)");
assert(isValidPassword("1234567a") === false, "Reject '1234567a' (missing uppercase)");
assert(isValidPassword("") === false, "Reject empty password");
assert(isValidPassword(null) === false, "Reject null password");

// 2. Valid passwords that MUST pass
assert(isValidPassword("Password1") === true, "Accept 'Password1' (upper + lower + number, 9 chars)");
assert(isValidPassword("Admin2026!") === true, "Accept 'Admin2026!' (upper + lower + number + symbol)");
assert(isValidPassword("Intern123") === true, "Accept 'Intern123' (upper + lower + number)");

console.log("\n==================================================");
console.log("TEST SUITE 2: FORM VALIDATORS (Register & Reset)");
console.log("==================================================");

const weakReg = validateRegister({
  fullName: "Budi Santoso",
  email: "budi@example.com",
  phoneNumber: "081234567890",
  participantType: "UNIVERSITY",
  university: "Universitas Indonesia",
  studyProgram: "Informatika",
  studentId: "12345678",
  internshipPeriod: "Januari 2026",
  password: "weakpassword",
  confirmPassword: "weakpassword"
});
assert(weakReg.valid === false, "validateRegister rejects weak password without uppercase/numbers");
assert(weakReg.errors.some(e => e.includes("huruf besar, huruf kecil, serta angka")), "validateRegister contains descriptive complexity error");

const validReg = validateRegister({
  fullName: "Budi Santoso",
  email: "budi@example.com",
  phoneNumber: "081234567890",
  participantType: "UNIVERSITY",
  university: "Universitas Indonesia",
  studyProgram: "Informatika",
  studentId: "12345678",
  internshipPeriod: "Januari 2026",
  password: "Password123",
  confirmPassword: "Password123"
});
assert(validReg.valid === true, "validateRegister accepts valid compliant password");

const weakReset = validateResetPassword({
  password: "12345678",
  confirmPassword: "12345678"
});
assert(weakReset.valid === false, "validateResetPassword rejects weak numbers-only password");

const validReset = validateResetPassword({
  password: "NewPassword123",
  confirmPassword: "NewPassword123"
});
assert(validReset.valid === true, "validateResetPassword accepts valid compliant password");

console.log("\n==================================================");
console.log("TEST SUITE 3: LOGIN POLICY PRESERVATION");
console.log("==================================================");

const loginCheck = validateLogin({
  email: "user@example.com",
  password: "simplepassword"
});
assert(loginCheck.valid === true, "validateLogin does not reject non-complex passwords for existing user logins");

console.log("\n==================================================");
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("==================================================");
