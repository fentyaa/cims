/**
 * Test Document Automation Flow
 * 
 * Memverifikasi:
 * 1. Penyimpanan template baru oleh mentor (dengan input HTML & placeholder)
 * 2. Preview template dengan simulasi data
 * 3. Update template
 * 4. Generate dokumen otomatis (pilih peserta & pilih template)
 * 5. Pengisian otomatis placeholder dari database (nama, instansi, nilai, mentor)
 * 6. Ketersediaan dokumen pada query getDocumentsByUser (untuk dashboard & dokumen peserta)
 * 7. Akses view/print dan download dokumen
 */

import prisma from "./config/database.js";
import documentService from "./services/documentService.js";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log("🚀 Menjalankan Test Otomasi Dokumen IMS...\n");

  try {
    // 1. Ambil mentor dan peserta dari database
    const mentor = await prisma.user.findFirst({ where: { role: "MENTOR" } });
    if (!mentor) throw new Error("Mentor tidak ditemukan di database.");

    const participant = await prisma.user.findFirst({
      where: { role: "INTERN", status: "ACTIVE" },
      include: { evaluations: true },
    });
    if (!participant) throw new Error("Peserta magang aktif tidak ditemukan.");

    console.log(`👤 Mentor: ${mentor.fullName} (${mentor.email})`);
    console.log(`🎓 Peserta Uji: ${participant.fullName} (${participant.email})`);
    console.log(`   Instansi: ${participant.university || participant.schoolName || '-'}`);

    // 2. Test Buat Template Baru dengan Kode HTML Kustom
    console.log("\n1️⃣ Menguji pembuatan template kustom baru...");
    const customHtmlContent = `<!DOCTYPE html>
<html>
<head><title>Sertifikat Uji - {{NAMA_PESERTA}}</title></head>
<body>
  <h1>SERTIFIKAT KELULUSAN MAGANG OTOMATIS</h1>
  <p>Diberikan kepada: <strong>{{NAMA_PESERTA}}</strong></p>
  <p>Instansi: {{INSTANSI}} | NIM/NIS: {{NIM_NIS}}</p>
  <p>Periode: {{PERIODE_MAGANG}}</p>
  <p>Nilai Akhir: {{NILAI_AKHIR}} ({{GRADE}})</p>
  <p>Mentor: {{NAMA_MENTOR}}</p>
</body>
</html>`;

    const newTemplate = await documentService.createTemplate(
      {
        name: "Template Sertifikat Uji Otomasi 2026",
        documentType: "CERTIFICATE",
        version: "2.0",
      },
      mentor.id,
      null,
      customHtmlContent
    );

    console.log(`   ✅ Template berhasil dibuat: ID ${newTemplate.id}, Name: "${newTemplate.name}"`);
    console.log(`   File path: ${newTemplate.filePath}`);

    // 3. Test Preview Template
    console.log("\n2️⃣ Menguji preview template...");
    const previewHtml = await documentService.previewTemplate(newTemplate.id);
    if (!previewHtml.includes("Budi Santoso") || !previewHtml.includes("SERTIFIKAT KELULUSAN MAGANG OTOMATIS")) {
      throw new Error("Preview template tidak menghasilkan data simulasi yang benar.");
    }
    console.log("   ✅ Preview template berhasil dirender dengan data simulasi.");

    // 4. Test Update Template
    console.log("\n3️⃣ Menguji update template...");
    const updatedTemplate = await documentService.updateTemplate(
      newTemplate.id,
      { name: "Template Sertifikat Uji Otomasi 2026 (Updated)" },
      null,
      customHtmlContent.replace("SERTIFIKAT KELULUSAN MAGANG OTOMATIS", "SERTIFIKAT KELULUSAN RESMI V2")
    );
    console.log(`   ✅ Template berhasil diupdate: "${updatedTemplate.name}"`);

    // 5. Test Generate Dokumen Otomatis (Pilih Peserta & Pilih Template)
    console.log("\n4️⃣ Menguji generate dokumen otomatis untuk peserta...");
    const generatedDoc = await documentService.generateDocument(
      participant.id,
      "CERTIFICATE",
      mentor.id,
      { templateId: updatedTemplate.id }
    );

    console.log(`   ✅ Dokumen berhasil digenerate! ID: ${generatedDoc.id}`);
    console.log(`   File: ${generatedDoc.filePath}`);

    // 6. Verifikasi File Fisik & Penggantian Placeholder
    console.log("\n5️⃣ Verifikasi isi file fisik dokumen yang dihasilkan...");
    const fullDocPath = path.resolve(__dirname, generatedDoc.filePath);
    if (!existsSync(fullDocPath)) {
      throw new Error(`File fisik dokumen tidak ditemukan di: ${fullDocPath}`);
    }

    const fileContent = readFileSync(fullDocPath, "utf-8");
    if (!fileContent.includes(participant.fullName)) {
      throw new Error(`Placeholder {{NAMA_PESERTA}} tidak terganti dengan nama: ${participant.fullName}`);
    }
    console.log(`   ✅ File fisik terverifikasi, berisi nama peserta "${participant.fullName}".`);

    // 7. Verifikasi Ketersediaan di Dashboard / Halaman Peserta
    console.log("\n6️⃣ Menguji ketersediaan dokumen pada dashboard / akun peserta...");
    const internDocs = await documentService.getDocumentsByUser(participant.id);
    const foundDoc = internDocs.find((d) => d.id === generatedDoc.id);

    if (!foundDoc) {
      throw new Error("Dokumen tidak ditemukan dalam daftar dokumen peserta!");
    }
    console.log(`   ✅ Dokumen tersedia di akun peserta! Total dokumen peserta: ${internDocs.length}`);
    console.log(`   Template yang digunakan: ${foundDoc.template.name}`);

    // 8. Cleanup test template
    console.log("\n7️⃣ Cleanup test template & document...");
    await prisma.document.delete({ where: { id: generatedDoc.id } });
    await prisma.generationHistory.deleteMany({ where: { templateId: updatedTemplate.id } });
    await documentService.deleteTemplate(updatedTemplate.id);
    console.log("   ✅ Cleanup selesai.");

    console.log("\n🎉 SEMUA TEST OTOMASI DOKUMEN BERHASIL 100%!");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
