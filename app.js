/**
 * Internship Management System (IMS)
 * Entry point aplikasi Express.js
 *
 * Server ini menggunakan ES Modules (import/export).
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import expressLayouts from "express-ejs-layouts";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pgSession from "connect-pg-simple";
import pg from "pg";
import os from "os";
import { csrfMiddleware, csrfProtection } from "./middlewares/csrf.js";

// Load environment variables dari file .env
dotenv.config();

// ============================================================
// ENVIRONMENT VALIDATION (Fail-Closed)
// ============================================================

const requiredEnvVars = ["SESSION_SECRET", "DATABASE_URL"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName] || !process.env[varName].trim()
);

if (missingEnvVars.length > 0) {
  console.error("❌ Fatal Error: Missing required environment variable(s):");
  missingEnvVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  if (process.env.NODE_ENV !== "test") {
    process.exit(1);
  }
}

// Inisialisasi aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000;

// Mendapatkan __dirname setara untuk ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. STATIC ASSETS CACHING (Diletakkan di paling atas)
// File statis disajikan langsung tanpa melewati session / DB query
// ============================================================

const isProduction = process.env.NODE_ENV === "production";

app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: isProduction ? "1d" : 0,
    etag: true,
    lastModified: true,
  })
);

// ============================================================
// 2. SECURITY MIDDLEWARE (Helmet)
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: false, // Nonaktifkan CSP untuk Bootstrap CDN compatibility
    crossOriginEmbedderPolicy: false,
    hsts: isProduction
      ? {
          maxAge: 31536000, // 1 tahun
          includeSubDomains: true,
          preload: true,
        }
      : false,
    xFrameOptions: { action: "deny" },
    xContentTypeOptions: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hidePoweredBy: true,
  })
);

// Nonaktifkan header X-Powered-By untuk Express
app.disable("x-powered-by");

// ============================================================
// 3. PARSER REQUEST BODY
// ============================================================

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ============================================================
// 4. RATE LIMITER
// ============================================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 30, // maksimal 30 request per IP
  message: {
    success: false,
    message: "Terlalu banyak permintaan. Silakan coba lagi setelah 15 menit.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// 5. SESSION CONFIGURATION (Resilient Supabase Connection Pool)
// ============================================================

const PgStore = pgSession(session);

// Gunakan DIRECT_URL (port 5432) untuk koneksi persisten session store,
// karena DATABASE_URL (port 6543 / pgbouncer transaction mode) menutup koneksi idle.
const sessionDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const isLocalDb = sessionDbUrl.includes("localhost") || sessionDbUrl.includes("127.0.0.1");

const pgPool = new pg.Pool({
  connectionString: sessionDbUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: isLocalDb
    ? false
    : {
        rejectUnauthorized: false,
      },
});

pgPool.on("error", (err) => {
  // Tangkap pemutusan koneksi idle secara graceful tanpa menyebabkan crash
  console.warn("Notice: Idle DB session connection refreshed:", err.message);
});

// In-Memory Fast Cache untuk Session (0ms latency untuk request beruntun/klik cepat)
const pgStore = new PgStore({
  pool: pgPool,
  tableName: "Session",
  createTableIfMissing: false,
  pruneSessionInterval: 60 * 15,
  disableTouch: true,
  errorLog: (err) => {
    console.warn("Session store warning:", err.message);
  },
});

const sessionMemoryCache = new Map();
const SESSION_CACHE_TTL = 3 * 60 * 1000; // 3 menit in-memory

const origGet = pgStore.get.bind(pgStore);
const origSet = pgStore.set.bind(pgStore);
const origDestroy = pgStore.destroy.bind(pgStore);

pgStore.get = function (sid, fn) {
  const cached = sessionMemoryCache.get(sid);
  if (cached && Date.now() < cached.expiresAt) {
    return fn(null, cached.data);
  }
  origGet(sid, (err, sessionData) => {
    if (!err && sessionData) {
      sessionMemoryCache.set(sid, {
        data: sessionData,
        expiresAt: Date.now() + SESSION_CACHE_TTL,
      });
    }
    fn(err, sessionData);
  });
};

pgStore.set = function (sid, sessionData, fn) {
  sessionMemoryCache.set(sid, {
    data: sessionData,
    expiresAt: Date.now() + SESSION_CACHE_TTL,
  });
  origSet(sid, sessionData, fn);
};

pgStore.destroy = function (sid, fn) {
  sessionMemoryCache.delete(sid);
  origDestroy(sid, fn);
};

const sessionConfig = {
  name: "cims.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: pgStore,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 1 hari
    sameSite: "lax",
  },
  rolling: false,
};

app.use(session(sessionConfig));

// Middleware untuk menyediakan data session ke semua view
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.messages = req.session.messages || [];
  res.locals.currentPath = req.path || "";
  delete req.session.messages;
  next();
});

// ============================================================
// CSRF PROTECTION MIDDLEWARE
// ============================================================

// CSRF middleware: menyediakan token untuk semua view
app.use(csrfMiddleware);

// CSRF protection untuk semua route (kecuali GET/HEAD/OPTIONS)
app.use(csrfProtection);

// ============================================================
// VIEW ENGINE & CACHING
// ============================================================

// Menggunakan EJS sebagai template engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("view cache", isProduction); // Cache kompilasi template di production

// Middleware express-ejs-layouts
app.use(expressLayouts);
app.set("layout", "layouts/main");

// ============================================================
// ROUTING
// ============================================================

// Import routes
import indexRouter from "./routes/index.js";
import authRouter from "./routes/auth.js";

// Gunakan routes
app.use("/", indexRouter);
app.use("/auth", authLimiter, authRouter);

// ============================================================
// HANDLE 404 - Halaman Tidak Ditemukan
// ============================================================

app.use((req, res) => {
  res.status(404).render("pages/404", {
    title: "Halaman Tidak Ditemukan",
    layout: "layouts/main",
  });
});

// ============================================================
// HANDLE ERROR GLOBAL
// ============================================================

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error("Error:", err.stack);

  // Tangkap galat batas ukuran upload jika tidak tertangkap di router
  if (err && (err.name === "MulterError" || err.code === "LIMIT_FILE_SIZE")) {
    const uploadErrMsg =
      err.code === "LIMIT_FILE_SIZE"
        ? "Ukuran foto profil melebihi batas maksimal 2 MB. Silakan pilih foto dengan ukuran lebih kecil (maksimal 2 MB, format JPG/JPEG/PNG)."
        : `Gagal mengunggah berkas: ${err.message}`;

    if (req.session) {
      req.session.messages = [{ type: "danger", text: uploadErrMsg }];
    }
    const redirectUrl = req.get("Referrer") || req.originalUrl || "/";
    return res.redirect(redirectUrl);
  }

  const statusCode = err.status || 500;
  res.status(statusCode).render("pages/error", {
    title: "Terjadi Kesalahan",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Terjadi kesalahan internal server.",
    layout: "layouts/main",
  });
});

// ============================================================
// START SERVER
// ============================================================

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === "IPv4" && !alias.internal) {
        return alias.address;
      }
    }
  }
  return "127.0.0.1";
}

app.listen(PORT, "0.0.0.0", () => {
  const localIp = getLocalIpAddress();
  console.log(`🚀 Server IMS berjalan di:`);
  console.log(`   - Laptop / Komputer : http://localhost:${PORT}`);
  console.log(`   - HP (Jaringan Sama): http://${localIp}:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;

