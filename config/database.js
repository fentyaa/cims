/**
 * Konfigurasi koneksi database menggunakan Prisma Client.
 * Instance PrismaClient dibuat sekali dan di-reuse di seluruh aplikasi.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log:
    process.env.DEBUG_QUERIES === "true"
      ? ["query", "warn", "error"]
      : ["warn", "error"],
});

export default prisma;

