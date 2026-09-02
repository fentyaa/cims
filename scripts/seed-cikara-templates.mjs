import prisma from "../config/database.js";

async function seedCikaraTemplates() {
  console.log("🌱 Menyiapkan template resmi PT. CIKARA BAKTI NUSANTARA...");

  const mentor = await prisma.user.findFirst({
    where: { role: "MENTOR" },
  });

  if (!mentor) {
    console.log("⚠️ Mentor tidak ditemukan, melewati seeding template.");
    return;
  }

  // 1. Template Surat Keterangan Selesai Magang
  const existingKeterangan = await prisma.documentTemplate.findFirst({
    where: { name: "Surat Keterangan Selesai Magang PT. Cikara Bakti Nusantara" },
  });

  if (!existingKeterangan) {
    await prisma.documentTemplate.create({
      data: {
        name: "Surat Keterangan Selesai Magang PT. Cikara Bakti Nusantara",
        documentType: "LETTER",
        version: "1.0",
        filePath: "storage/templates/surat-keterangan-cikara.html",
        status: "ACTIVE",
        uploadedById: mentor.id,
      },
    });
    console.log("✅ Template Surat Keterangan PT. Cikara Bakti Nusantara berhasil didaftarkan.");
  } else {
    await prisma.documentTemplate.update({
      where: { id: existingKeterangan.id },
      data: {
        filePath: "storage/templates/surat-keterangan-cikara.html",
        status: "ACTIVE",
      },
    });
    console.log("✅ Template Surat Keterangan PT. Cikara Bakti Nusantara diperbarui.");
  }

  // 2. Template Surat Balasan Kerja Magang
  const existingBalasan = await prisma.documentTemplate.findFirst({
    where: { name: "Surat Balasan Kerja Magang PT. Cikara Bakti Nusantara" },
  });

  if (!existingBalasan) {
    await prisma.documentTemplate.create({
      data: {
        name: "Surat Balasan Kerja Magang PT. Cikara Bakti Nusantara",
        documentType: "LETTER",
        version: "1.0",
        filePath: "storage/templates/surat-balasan-magang-cikara.html",
        status: "ACTIVE",
        uploadedById: mentor.id,
      },
    });
    console.log("✅ Template Surat Balasan Kerja Magang PT. Cikara Bakti Nusantara berhasil didaftarkan.");
  } else {
    await prisma.documentTemplate.update({
      where: { id: existingBalasan.id },
      data: {
        filePath: "storage/templates/surat-balasan-magang-cikara.html",
        status: "ACTIVE",
      },
    });
    console.log("✅ Template Surat Balasan Kerja Magang PT. Cikara Bakti Nusantara diperbarui.");
  }
}

seedCikaraTemplates()
  .catch((e) => console.error("Error seeding templates:", e))
  .finally(() => prisma.$disconnect());
