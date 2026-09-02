/**
 * Home Controller
 * Menangani request untuk halaman utama (/).
 */

/**
 * Menampilkan halaman utama (Home).
 * @param {import("express").Request} req - Object request Express
 * @param {import("express").Response} res - Object response Express
 */
export const getHome = (req, res) => {
  const currentYear = new Date().getFullYear();

  res.render("pages/home", {
    title: "Internship Management System",
    appName: "Internship Management System",
    tagline: "Kelola peserta magang dengan mudah, cepat, dan terstruktur.",
    currentYear,
  });
};

