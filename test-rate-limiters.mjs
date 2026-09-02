/**
 * Automated Verification Script for Targeted Rate Limiters (Part 2B)
 */

import { createWebRateLimiter, profileUpdateLimiter, bulkCertificateLimiter, bulkLetterLimiter } from "./middlewares/rateLimiter.js";

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

// Helper to simulate request through an express middleware
function simulateRequest(limiter, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; return this; },
      getHeader(k) { return this.headers[k]; },
      status(code) { this.statusCode = code; return this; },
      redirect(url) {
        resolve({ type: "redirect", status: this.statusCode, url, messages: req.session?.messages });
      }
    };

    let nextCalled = false;
    limiter(req, res, (err) => {
      nextCalled = true;
      resolve({ type: "next", error: err, status: res.statusCode });
    });
  });
}

console.log("==================================================");
console.log("TEST SUITE 1: CUSTOM WEB RATE LIMITER FACTORY");
console.log("==================================================");

// Create a small test limiter: 3 requests per minute
const testLimiter = createWebRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: "Test limit exceeded.",
  fallbackRedirect: "/fallback"
});

// User 1 requests
const user1Req = () => ({
  ip: "127.0.0.1",
  session: { user: { id: "user-1" }, messages: [] },
  get: () => "/source-page"
});

// User 2 requests
const user2Req = () => ({
  ip: "127.0.0.1",
  session: { user: { id: "user-2" }, messages: [] },
  get: () => "/source-page"
});

async function runTests() {
  // Test 1: User 1 within limit
  const r1 = await simulateRequest(testLimiter, user1Req());
  assert(r1.type === "next", "User 1, request 1 allowed (next called)");

  const r2 = await simulateRequest(testLimiter, user1Req());
  assert(r2.type === "next", "User 1, request 2 allowed (next called)");

  const r3 = await simulateRequest(testLimiter, user1Req());
  assert(r3.type === "next", "User 1, request 3 allowed (next called)");

  // Test 2: User 1 exceeding limit
  const r4 = await simulateRequest(testLimiter, user1Req());
  assert(r4.type === "redirect", "User 1, request 4 blocked (redirect returned)");
  assert(r4.status === 429, "Blocked response returns HTTP 429 status code");
  assert(r4.url === "/source-page", "Redirects to referrer or fallback URL");
  assert(r4.messages && r4.messages.length > 0 && r4.messages[0].text === "Test limit exceeded.", "Flash danger message populated in session");

  // Test 3: User 2 on same IP has independent bucket (user-scoped)
  const u2r1 = await simulateRequest(testLimiter, user2Req());
  assert(u2r1.type === "next", "User 2 on same IP allowed (isolated user quota)");

  console.log("\n==================================================");
  console.log("TEST SUITE 2: PROFILE UPDATE LIMITER");
  console.log("==================================================");

  const internReq = () => ({
    ip: "10.0.0.5",
    session: { user: { id: "intern-123" }, messages: [] },
    get: () => "/intern/profil"
  });

  const pRes1 = await simulateRequest(profileUpdateLimiter, internReq());
  assert(pRes1.type === "next", "Profile limiter allows initial requests");

  console.log("\n==================================================");
  console.log("TEST SUITE 3: BULK CERTIFICATE & LETTER LIMITERS");
  console.log("==================================================");

  const mentorReq = () => ({
    ip: "192.168.1.100",
    session: { user: { id: "mentor-admin" }, messages: [] },
    get: () => "/mentor/dokumen/sertifikat"
  });

  const certRes1 = await simulateRequest(bulkCertificateLimiter, mentorReq());
  assert(certRes1.type === "next", "Bulk certificate limiter allows initial requests");

  const letterRes1 = await simulateRequest(bulkLetterLimiter, mentorReq());
  assert(letterRes1.type === "next", "Bulk letter limiter allows initial requests");

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================");
}

await runTests();
