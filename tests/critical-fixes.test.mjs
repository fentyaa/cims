/**
 * Automated Verification Script for Critical Security Fixes
 */

import { generateToken, csrfProtection } from "../middlewares/csrf.js";
import { upload, uploadAttachment } from "../middlewares/upload.js";
import path from "path";

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
console.log("TEST SUITE 1: CSRF PROTECTION LOGIC");
console.log("==================================================");

// Test 1.1: Token generation
const token1 = generateToken();
const token2 = generateToken();
assert(typeof token1 === "string" && token1.length === 64, "generateToken generates 64-char hex string");
assert(token1 !== token2, "generateToken generates unique tokens");

// Test 1.2: CSRF safe methods bypass
let safeMethodCalled = false;
csrfProtection({ method: "GET" }, {}, () => { safeMethodCalled = true; });
assert(safeMethodCalled, "GET requests safely bypass CSRF protection");

// Test 1.3: Reject missing token
let rejectedMissing = false;
const mockReqNoToken = {
  method: "POST",
  session: { csrfToken: token1 },
  body: {},
  headers: {},
  is: () => false,
  get: () => "/login"
};
const mockResRedirect = {
  status() { return this; },
  redirect: (url) => { rejectedMissing = true; }
};
csrfProtection(mockReqNoToken, mockResRedirect, () => {});
assert(rejectedMissing, "POST without CSRF token is rejected and redirected");

// Test 1.4: Reject query string CSRF token (must not allow req.query._csrf)
let rejectedQueryToken = false;
const mockReqQueryToken = {
  method: "POST",
  session: { csrfToken: token1 },
  body: {},
  query: { _csrf: token1 },
  headers: {},
  is: () => false,
  get: () => "/login"
};
csrfProtection(mockReqQueryToken, {
  status() { return this; },
  redirect: () => { rejectedQueryToken = true; }
}, () => {});
assert(rejectedQueryToken, "CSRF token in query string is strictly rejected");

// Test 1.5: Accept valid body token
let acceptedBodyToken = false;
const mockReqValidBody = {
  method: "POST",
  session: { csrfToken: token1 },
  body: { _csrf: token1 },
  headers: {},
  is: () => false
};
csrfProtection(mockReqValidBody, {}, () => { acceptedBodyToken = true; });
assert(acceptedBodyToken, "Valid CSRF token in body is accepted");

// Test 1.6: Accept valid header token
let acceptedHeaderToken = false;
const mockReqValidHeader = {
  method: "POST",
  session: { csrfToken: token1 },
  body: {},
  headers: { "x-csrf-token": token1 },
  is: () => false
};
csrfProtection(mockReqValidHeader, {}, () => { acceptedHeaderToken = true; });
assert(acceptedHeaderToken, "Valid CSRF token in x-csrf-token header is accepted");

// Test 1.7: Reject mismatched token
let rejectedMismatch = false;
const mockReqMismatch = {
  method: "POST",
  session: { csrfToken: token1 },
  body: { _csrf: token2 },
  headers: {},
  is: () => false,
  get: () => "/login"
};
csrfProtection(mockReqMismatch, {
  status() { return this; },
  redirect: () => { rejectedMismatch = true; }
}, () => {});
assert(rejectedMismatch, "Mismatched CSRF token is rejected");

console.log("\n==================================================");
console.log("TEST SUITE 2: FILE UPLOAD SECURITY (WHITELIST & FILTER)");
console.log("==================================================");

// Test filter directly from multer instances
const testProfileFilter = (file) => {
  return new Promise((resolve) => {
    upload.fileFilter({}, file, (err, result) => {
      resolve({ err, result });
    });
  });
};

const testAttachmentFilter = (file) => {
  return new Promise((resolve) => {
    uploadAttachment.fileFilter({}, file, (err, result) => {
      resolve({ err, result });
    });
  });
};

async function runUploadTests() {
  // Test 2.1: Valid profile image
  const resValidJpg = await testProfileFilter({ fieldname: "profilePhoto", originalname: "avatar.jpg", mimetype: "image/jpeg" });
  assert(resValidJpg.result === true && !resValidJpg.err, "Profile: Valid .jpg + image/jpeg accepted");

  const resValidPng = await testProfileFilter({ fieldname: "profilePhoto", originalname: "photo.png", mimetype: "image/png" });
  assert(resValidPng.result === true && !resValidPng.err, "Profile: Valid .png + image/png accepted");

  // Test 2.2: Disallowed script/HTML files
  const resHtml = await testProfileFilter({ fieldname: "profilePhoto", originalname: "exploit.html", mimetype: "text/html" });
  assert(resHtml.result === false || resHtml.err, "Profile: .html file is strictly rejected");

  const resSvg = await testProfileFilter({ fieldname: "profilePhoto", originalname: "exploit.svg", mimetype: "image/svg+xml" });
  assert(resSvg.result === false || resSvg.err, "Profile: .svg file is strictly rejected");

  const resJs = await testProfileFilter({ fieldname: "profilePhoto", originalname: "payload.js", mimetype: "application/javascript" });
  assert(resJs.result === false || resJs.err, "Profile: .js file is strictly rejected");

  const resPhp = await testProfileFilter({ fieldname: "profilePhoto", originalname: "shell.php", mimetype: "application/x-php" });
  assert(resPhp.result === false || resPhp.err, "Profile: .php file is strictly rejected");

  // Test 2.3: MIME spoofing attempt (Extension .jpg with text/html MIME or .php with image/jpeg)
  const resSpoofedMime = await testProfileFilter({ fieldname: "profilePhoto", originalname: "fake.jpg", mimetype: "text/html" });
  assert(resSpoofedMime.result === false || resSpoofedMime.err, "Profile: Spoofed MIME (fake.jpg with text/html) is rejected");

  const resSpoofedExt = await testProfileFilter({ fieldname: "profilePhoto", originalname: "fake.php", mimetype: "image/jpeg" });
  assert(resSpoofedExt.result === false || resSpoofedExt.err, "Profile: Spoofed Extension (fake.php with image/jpeg) is rejected");

  // Test 2.4: Attachment valid formats
  const resPdf = await testAttachmentFilter({ fieldname: "attachment", originalname: "report.pdf", mimetype: "application/pdf" });
  assert(resPdf.result === true && !resPdf.err, "Attachment: Valid .pdf + application/pdf accepted");

  const resDocx = await testAttachmentFilter({
    fieldname: "attachment",
    originalname: "document.docx",
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  assert(resDocx.result === true && !resDocx.err, "Attachment: Valid .docx + openxmlformats accepted");

  // Test 2.5: Attachment rejecting HTML/SVG
  const resAttHtml = await testAttachmentFilter({ fieldname: "attachment", originalname: "attack.html", mimetype: "text/html" });
  assert(resAttHtml.result === false || resAttHtml.err, "Attachment: .html attachment is strictly rejected");

  const resAttSvg = await testAttachmentFilter({ fieldname: "attachment", originalname: "vector.svg", mimetype: "image/svg+xml" });
  assert(resAttSvg.result === false || resAttSvg.err, "Attachment: .svg attachment is strictly rejected");
}

await runUploadTests();

console.log("\n==================================================");
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("==================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
