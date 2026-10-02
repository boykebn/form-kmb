import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";
import express from "express";
import { google } from "googleapis";
import multer from "multer";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const uploadDir = path.join(rootDir, "uploads");
const clientDistDir = path.join(rootDir, "client", "dist");
const clientIndexPath = path.join(clientDistDir, "index.html");
const jsonPath = path.join(dataDir, "submissions.json");
const csvPath = path.join(dataDir, "submissions.csv");

const app = express();
const port = Number(process.env.PORT || 4444);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
let databasePool;

const fields = [
  "no",
  "siteName",
  "address",
  "googleMapUrl",
  "city",
  "province",
  "rentalPrice",
  "jenis",
  "slot",
  "venuePic",
  "accountNumber",
  "rentPeriod",
  "keyAccount",
  "noTelpLokasi",
  "fotoLokasi",
  "approval",
  "awalKontrak",
  "akhirKontrak",
  "masaKontrak",
  "terminPembayaran",
];

const sheetHeaders = [
  "No",
  "Site Name",
  "Address",
  "Google Map URL",
  "City",
  "Province",
  "Rental Price",
  "Jenis",
  "Slot / Jumlah EVCS",
  "Venue PIC",
  "Account Number",
  "Rent Period",
  "Key Account",
  "No. Telp Lokasi",
  "Foto Lokasi",
  "Approval",
  "Awal Kontrak",
  "Akhir Kontrak",
  "Masa Kontrak",
  "Termin Pembayaran",
];

const sheetHeaderFields = new Map(sheetHeaders.map((header, index) => [header, fields[index]]));
const legacySheetHeaders = sheetHeaders
  .filter((header) => header !== "Jenis")
  .map((header) => (header === "Slot / Jumlah EVCS" ? "Slot" : header));
const databaseColumns = [
  "no",
  "site_name",
  "address",
  "google_map_url",
  "city",
  "province",
  "rental_price",
  "jenis",
  "slot",
  "venue_pic",
  "account_number",
  "rent_period",
  "key_account",
  "no_telp_lokasi",
  "foto_lokasi",
  "approval",
  "awal_kontrak",
  "akhir_kontrak",
  "masa_kontrak",
  "termin_pembayaran",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("File harus berupa gambar."));
      return;
    }
    callback(null, true);
  },
});

const dataUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: getStorageLabel(),
    database: hasDatabaseConfig(),
  });
});

app.get("/api/gallery/bss", async (_req, res, next) => {
  try {
    const images = hasCloudinaryConfig() ? await listBssGalleryImages() : [];
    res.json({ images });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/login", (req, res) => {
  const password = clean(req.body?.password);

  if (!process.env.ADMIN_PASSWORD) {
    return res
      .status(503)
      .json({ message: "Password admin belum dikonfigurasi." });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Password admin salah." });
  }

  res.json({ token: createAdminToken() });
});

app.get("/api/submissions", requireAdmin, async (_req, res, next) => {
  try {
    const submissions = await listSubmissions();
    res.json({ submissions });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/submissions/:no", requireAdmin, async (req, res, next) => {
  try {
    const submissionNo = Number(req.params.no);

    if (!Number.isInteger(submissionNo) || submissionNo < 1) {
      return res.status(400).json({ message: "Nomor submission tidak valid." });
    }

    const updates = normalizeSubmissionUpdates(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Tidak ada data yang diubah." });
    }

    const updatedSubmission = await updateSubmission(submissionNo, updates);

    if (!updatedSubmission) {
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    res.json({
      message: "Data berhasil diperbarui.",
      submission: updatedSubmission,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/submissions/:no", requireAdmin, async (req, res, next) => {
  try {
    const submissionNo = Number(req.params.no);

    if (!Number.isInteger(submissionNo) || submissionNo < 1) {
      return res.status(400).json({ message: "Nomor submission tidak valid." });
    }

    const deleted = await deleteSubmission(submissionNo);

    if (!deleted) {
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    res.json({ message: "Data berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/submissions/import-sheets", requireAdmin, async (_req, res, next) => {
  try {
    if (!hasDatabaseConfig()) {
      return res.status(503).json({ message: "Database belum dikonfigurasi." });
    }

    if (!hasSheetsConfig()) {
      return res.status(503).json({ message: "Google Sheets belum dikonfigurasi." });
    }

    const importResult = await importGoogleSheetsToDatabase();
    const submissions = await listSubmissions();

    res.json({
      message: `Import selesai. Masuk/update: ${importResult.imported}. Dilewati: ${importResult.skipped}.`,
      ...importResult,
      submissions,
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/submissions/import-file",
  requireAdmin,
  dataUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!hasDatabaseConfig()) {
        return res.status(503).json({ message: "Database belum dikonfigurasi." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "File import belum dipilih." });
      }

      const importResult = await importDataFileToDatabase(req.file);
      const submissions = await listSubmissions();

      res.json({
        message: `Import selesai. Masuk/update: ${importResult.imported}. Dilewati: ${importResult.skipped}.`,
        ...importResult,
        submissions,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/submissions/export.csv", requireAdmin, async (_req, res, next) => {
  try {
    const submissions = await listSubmissions();
    const rows = [
      sheetHeaders.map(escapeCsv).join(","),
      ...submissions.map((submission) =>
        fields
          .map((field) =>
            escapeCsv(
              field === "fotoLokasi" && Array.isArray(submission[field])
                ? submission[field].join("\n")
                : submission[field],
            ),
          )
          .join(","),
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="data-pendaftaran-bss-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(`\uFEFF${rows.join("\n")}\n`);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/uploads",
  ensureUploadDir,
  upload.array("fotoLokasi", 10),
  async (req, res, next) => {
    try {
      const files = req.files || [];

      if (files.length === 0) {
        return res.status(400).json({ message: "Foto lokasi belum dipilih." });
      }

      const uploadedFiles = hasCloudinaryConfig()
        ? await uploadFilesToCloudinary(files)
        : hasDriveConfig()
          ? await uploadFilesToGoogleDrive(files)
          : await saveFilesLocally(files, req);

      res.status(201).json({
        files: uploadedFiles,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/submissions", async (req, res, next) => {
  try {
    const formData = normalizeFormData(req.body);
    const errors = validateFormData(formData);

    if (errors.length > 0) {
      return res.status(400).json({ message: "Data belum lengkap.", errors });
    }

    const submission = await buildInternalSubmission(formData);

    await saveSubmission(submission);
    await mirrorToGoogleSheets(submission);

    res
      .status(201)
      .json({ message: "Terima kasih, respons Anda sudah terkirim." });
  } catch (error) {
    next(error);
  }
});

if (existsSync(clientIndexPath)) {
  app.use(express.static(clientDistDir));

  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }

    res.sendFile(clientIndexPath);
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res
    .status(500)
    .json({ message: "Server sedang bermasalah. Coba lagi sebentar." });
});

const server = app.listen(port, () => {
  console.log(`API berjalan di http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

function normalizeFormData(input = {}) {
  return {
    agentPic: clean(input.agentPic),
    noTelpAgent: clean(input.noTelpAgent),
    namaLokasi: clean(input.namaLokasi),
    namaPenanggungJawabLokasi: clean(input.namaPenanggungJawabLokasi),
    noTelpLokasi: clean(input.noTelpLokasi),
    alamat: clean(input.alamat),
    googleMapUrl: clean(input.googleMapUrl),
    kota: clean(input.kota),
    kecamatan: clean(input.kecamatan),
    kelurahan: clean(input.kelurahan),
    provinsi: clean(input.provinsi),
    jenis: clean(input.jenis) || "BSS",
    slotBss: clean(input.slotBss),
    fotoLokasi: clean(input.fotoLokasi),
  };
}

function validateFormData(formData) {
  const errors = [];

  if (!formData.agentPic)
    errors.push({ field: "agentPic", message: "Agent / PIC wajib diisi." });
  if (!formData.noTelpAgent)
    errors.push({
      field: "noTelpAgent",
      message: "No. Telp Agent wajib diisi.",
    });
  if (!formData.namaLokasi)
    errors.push({ field: "namaLokasi", message: "Nama lokasi wajib diisi." });
  if (!formData.namaPenanggungJawabLokasi) {
    errors.push({
      field: "namaPenanggungJawabLokasi",
      message: "Nama penanggung jawab lokasi wajib diisi.",
    });
  }
  if (!formData.noTelpLokasi) {
    errors.push({
      field: "noTelpLokasi",
      message: "No. Telp Lokasi wajib diisi.",
    });
  }
  if (!formData.alamat)
    errors.push({ field: "alamat", message: "Alamat wajib diisi." });
  if (!formData.googleMapUrl) {
    errors.push({
      field: "googleMapUrl",
      message: "Google Map URL wajib diisi.",
    });
  }
  if (!formData.kota)
    errors.push({ field: "kota", message: "Kota wajib diisi." });
  if (!formData.kecamatan)
    errors.push({ field: "kecamatan", message: "Kecamatan wajib diisi." });
  if (!formData.kelurahan)
    errors.push({ field: "kelurahan", message: "Kelurahan wajib diisi." });
  if (!formData.provinsi)
    errors.push({ field: "provinsi", message: "Provinsi wajib diisi." });
  const hasValidJenis = ["BSS", "EVCS"].includes(formData.jenis);
  if (!hasValidJenis) {
    errors.push({ field: "jenis", message: "Jenis wajib dipilih." });
  }
  if (!hasValidJenis || !isValidCapacity(formData.jenis, formData.slotBss)) {
    errors.push({
      field: "slotBss",
      message:
        formData.jenis === "EVCS"
          ? "Jumlah EVCS wajib dipilih."
          : "Slot BSS wajib dipilih.",
    });
  }
  if (!formData.fotoLokasi) {
    errors.push({
      field: "fotoLokasi",
      message: "Foto lokasi wajib diupload.",
    });
  }

  return errors;
}

function normalizeSubmissionUpdates(input = {}) {
  const allowedFields = [
    "siteName",
    "address",
    "googleMapUrl",
    "city",
    "province",
    "rentalPrice",
    "jenis",
    "slot",
    "venuePic",
    "accountNumber",
    "rentPeriod",
    "keyAccount",
    "noTelpLokasi",
    "approval",
    "awalKontrak",
    "akhirKontrak",
    "masaKontrak",
    "terminPembayaran",
  ];

  return Object.fromEntries(
    allowedFields
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, clean(input[field])]),
  );
}

function clean(value) {
  return String(value ?? "").trim();
}

function requireAdmin(req, res, next) {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!verifyAdminToken(token)) {
    res.status(401).json({ message: "Akses admin diperlukan." });
    return;
  }

  next();
}

function createAdminToken() {
  const payload = {
    role: "admin",
    exp: Date.now() + 8 * 60 * 60 * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = signAdminPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function verifyAdminToken(token) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = signAdminPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function signAdminPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", getAdminSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "local-admin-session-secret"
  );
}

function safeEqual(value, expectedValue) {
  const valueBuffer = Buffer.from(String(value));
  const expectedBuffer = Buffer.from(String(expectedValue));

  if (valueBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

async function ensureUploadDir(_req, _res, next) {
  try {
    await mkdir(uploadDir, { recursive: true });
    next();
  } catch (error) {
    next(error);
  }
}

async function buildInternalSubmission(formData) {
  return {
    no: await getNextSubmissionNumber(),
    siteName: formData.namaLokasi,
    address: formData.alamat,
    googleMapUrl: formData.googleMapUrl,
    city: formData.kota,
    province: formData.provinsi,
    rentalPrice: "",
    jenis: formData.jenis,
    slot: formData.slotBss,
    venuePic: formData.namaPenanggungJawabLokasi,
    accountNumber: formData.noTelpAgent,
    rentPeriod: "",
    keyAccount: formData.agentPic,
    noTelpLokasi: formData.noTelpLokasi,
    fotoLokasi: formData.fotoLokasi,
    approval: "",
    awalKontrak: "",
    akhirKontrak: "",
    masaKontrak: "",
    terminPembayaran: "",
  };
}

async function getNextSubmissionNumber() {
  if (hasDatabaseConfig()) {
    return null;
  }

  return getNextLocalNumber();
}

async function getNextLocalNumber() {
  const existing = await readJsonArray(jsonPath);
  return existing.length + 1;
}

async function saveSubmission(submission) {
  if (hasDatabaseConfig()) {
    submission.no = await saveToDatabase(submission);
    await saveLocalBackup(submission);
    return;
  }

  await saveLocal(submission);
}

async function saveLocalBackup(submission) {
  try {
    await saveLocal(submission);
  } catch (error) {
    console.error("Gagal membuat backup lokal submission:", error);
  }
}

async function saveLocal(submission) {
  await mkdir(dataDir, { recursive: true });

  const existing = await readJsonArray(jsonPath);
  existing.push(submission);
  await writeFile(jsonPath, `${JSON.stringify(existing, null, 2)}\n`);

  const csvExists = existing.length > 1;
  const rows = [
    ...(csvExists ? [] : [fields.map(escapeCsv).join(",")]),
    fields.map((field) => escapeCsv(submission[field])).join(","),
  ];
  await writeFile(csvPath, `${rows.join("\n")}\n`, {
    flag: csvExists ? "a" : "w",
  });
}

async function readJsonArray(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return [];
  }
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function hasSheetsConfig() {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY,
  );
}

function hasDriveConfig() {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY,
  );
}

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET),
  );
}

function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL);
}

function getStorageLabel() {
  const fileStorage = hasCloudinaryConfig()
    ? "cloudinary"
    : hasDriveConfig()
      ? "google-drive"
      : "local";
  const dataStorage = hasDatabaseConfig() ? "postgres" : "local";
  const sheetsMirror =
    process.env.GOOGLE_SHEETS_MIRROR === "true" && hasSheetsConfig()
      ? "+google-sheets-mirror"
      : "";
  return `${fileStorage}+${dataStorage}${sheetsMirror}`;
}

function getGoogleAuth(scopes) {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes,
  });
}

async function appendToGoogleSheets(submission) {
  if (!hasSheetsConfig()) return;

  const auth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);

  const sheets = google.sheets({ version: "v4", auth });
  const tabName = process.env.GOOGLE_SHEETS_TAB || "Responses";

  const targetHeaders = await ensureSheetHeader(sheets, tabName);
  const targetFields = targetHeaders.map((header) => sheetHeaderFields.get(header)).filter(Boolean);
  const lastColumn = getColumnName(targetFields.length);
  const sheetSubmission = {
    ...submission,
    no: await getNextSheetNumber(sheets, tabName),
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${tabName}!A:${lastColumn}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [targetFields.map((field) => sheetSubmission[field])],
    },
  });
}

async function mirrorToGoogleSheets(submission) {
  if (process.env.GOOGLE_SHEETS_MIRROR !== "true") return;

  try {
    await appendToGoogleSheets(submission);
  } catch (error) {
    console.error("Gagal mirror data ke Google Sheets:", error);
  }
}

async function readRowsFromGoogleSheets() {
  const auth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets.readonly"]);
  const sheets = google.sheets({ version: "v4", auth });
  const tabName = process.env.GOOGLE_SHEETS_TAB || "db_registrasi";

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${tabName}!A:T`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) return [];

  const firstRow = rows[0].map(clean);
  const hasHeader = sheetHeaders.every((header, index) => firstRow[index] === header);
  const hasLegacyHeader = legacySheetHeaders.every(
    (header, index) => firstRow[index] === header,
  );

  return hasHeader || hasLegacyHeader ? rows.slice(1) : rows;
}

async function importGoogleSheetsToDatabase() {
  const rows = await readRowsFromGoogleSheets();
  return importRowsToDatabase(rows);
}

async function importDataFileToDatabase(file) {
  const fileName = file.originalname.toLowerCase();

  if (!fileName.endsWith(".csv") && !fileName.endsWith(".tsv")) {
    throw new Error("Format import yang didukung saat ini CSV atau TSV.");
  }

  const text = file.buffer.toString("utf8").replace(/^\uFEFF/, "");
  const delimiter = fileName.endsWith(".tsv") ? "\t" : ",";
  const rows = parseDelimitedText(text, delimiter);

  return importRowsToDatabase(rows);
}

async function importRowsToDatabase(rows) {
  let imported = 0;
  let skipped = 0;

  for (const [index, row] of rows.entries()) {
    if (isEmptySheetRow(row)) {
      skipped += 1;
      continue;
    }

    const submission = normalizeSheetImportRow(row, index + 1);

    if (!submission.slot) {
      skipped += 1;
      continue;
    }

    await upsertDatabaseSubmissionWithNo(submission);
    imported += 1;
  }

  await syncDatabaseNoSequence();

  return { imported, skipped };
}

function parseDelimitedText(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (char === delimiter && !isQuoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const firstRow = rows[0]?.map(clean) || [];
  const hasHeader = sheetHeaders.every((header, index) => firstRow[index] === header);
  const hasLegacyHeader = legacySheetHeaders.every(
    (header, index) => firstRow[index] === header,
  );

  return hasHeader || hasLegacyHeader ? rows.slice(1) : rows;
}

function normalizeSheetImportRow(row, fallbackNo) {
  const normalizedRow = normalizeImportCells(row);
  const paddedRow = fields.map((field, index) => [field, clean(normalizedRow[index])]);
  const submission = Object.fromEntries(paddedRow);
  submission.no = cleanSheetNo(submission.no) || fallbackNo;
  submission.jenis = cleanJenis(submission.jenis || "BSS");
  submission.slot = cleanSheetSlot(submission.slot, submission.jenis);
  return submission;
}

function normalizeImportCells(row) {
  if (row.length === fields.length - 1) {
    const normalizedRow = [...row];
    normalizedRow.splice(fields.indexOf("jenis"), 0, "BSS");
    return normalizedRow;
  }

  return row;
}

function isEmptySheetRow(row) {
  return row.every((value) => !clean(value));
}

function cleanSheetNo(value) {
  const number = Number(clean(value));
  return Number.isInteger(number) && number > 0 ? number : null;
}

function cleanSheetSlot(value, jenis = "BSS") {
  const allowedSlots = jenis === "EVCS" ? ["1", "2"] : ["6", "12"];
  const slot = clean(value).match(/\b(1|2|6|12)\b/)?.[1] || clean(value);
  return allowedSlots.includes(slot) ? slot : "";
}

function getDatabasePool() {
  if (!databasePool) {
    databasePool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  return databasePool;
}

async function upsertDatabaseSubmissionWithNo(submission) {
  const updateColumns = databaseColumns
    .filter((column) => column !== "no")
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");
  const placeholders = databaseColumns.map((_, index) => `$${index + 1}`).join(", ");

  await getDatabasePool().query(
    `
      INSERT INTO bss_registrations (${databaseColumns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (no) DO UPDATE SET ${updateColumns}
    `,
    [
      submission.no,
      submission.siteName,
      submission.address,
      submission.googleMapUrl,
      submission.city,
      submission.province,
      submission.rentalPrice,
      submission.jenis,
      submission.slot,
      submission.venuePic,
      submission.accountNumber,
      submission.rentPeriod,
      submission.keyAccount,
      submission.noTelpLokasi,
      submission.fotoLokasi,
      submission.approval,
      submission.awalKontrak,
      submission.akhirKontrak,
      submission.masaKontrak,
      submission.terminPembayaran,
    ],
  );
}

async function syncDatabaseNoSequence() {
  await getDatabasePool().query(`
    SELECT setval(
      pg_get_serial_sequence('bss_registrations', 'no'),
      COALESCE((SELECT MAX(no) FROM bss_registrations), 1),
      true
    )
  `);
}

async function saveToDatabase(submission) {
  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");

    const response = await client.query(
      `
        INSERT INTO bss_registrations (
          site_name,
          address,
          google_map_url,
          city,
          province,
          rental_price,
          jenis,
          slot,
          venue_pic,
          account_number,
          rent_period,
          key_account,
          no_telp_lokasi,
          foto_lokasi,
          approval,
          awal_kontrak,
          akhir_kontrak,
          masa_kontrak,
          termin_pembayaran
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19
        )
        RETURNING no
      `,
      [
        submission.siteName,
        submission.address,
        submission.googleMapUrl,
        submission.city,
        submission.province,
        submission.rentalPrice,
        submission.jenis,
        submission.slot,
        submission.venuePic,
        submission.accountNumber,
        submission.rentPeriod,
        submission.keyAccount,
        submission.noTelpLokasi,
        submission.fotoLokasi,
        submission.approval,
        submission.awalKontrak,
        submission.akhirKontrak,
        submission.masaKontrak,
        submission.terminPembayaran,
      ],
    );

    const submissionNo = Number(response.rows[0].no);

    await client.query("COMMIT");
    return submissionNo;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function parsePhotoUrls(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function listSubmissions() {
  if (hasDatabaseConfig()) {
    return listDatabaseSubmissions();
  }

  const existing = await readJsonArray(jsonPath);
  return existing
    .slice()
    .reverse()
    .map((submission) => ({
      no: submission.no,
      siteName: submission.siteName,
      address: submission.address,
      googleMapUrl: submission.googleMapUrl,
      city: submission.city,
      province: submission.province,
      rentalPrice: submission.rentalPrice,
      jenis: submission.jenis || "BSS",
      slot: submission.slot,
      venuePic: submission.venuePic,
      accountNumber: submission.accountNumber,
      rentPeriod: submission.rentPeriod,
      keyAccount: submission.keyAccount,
      noTelpLokasi: submission.noTelpLokasi,
      fotoLokasi: parsePhotoUrls(submission.fotoLokasi),
      approval: submission.approval,
      awalKontrak: submission.awalKontrak,
      akhirKontrak: submission.akhirKontrak,
      masaKontrak: submission.masaKontrak,
      terminPembayaran: submission.terminPembayaran,
      createdAt: "",
    }));
}

async function listDatabaseSubmissions() {
  const response = await getDatabasePool().query(`
    SELECT
      no,
      site_name,
      address,
      google_map_url,
      city,
      province,
      rental_price,
      jenis,
      slot,
      venue_pic,
      account_number,
      rent_period,
      key_account,
      no_telp_lokasi,
      foto_lokasi,
      approval,
      awal_kontrak,
      akhir_kontrak,
      masa_kontrak,
      termin_pembayaran,
      created_at
    FROM bss_registrations
    ORDER BY no ASC
    LIMIT 500
  `);

  return response.rows.map((row) => ({
    no: row.no,
    siteName: row.site_name,
    address: row.address,
    googleMapUrl: row.google_map_url,
    city: row.city,
    province: row.province,
    rentalPrice: row.rental_price,
    jenis: row.jenis || "BSS",
    slot: row.slot,
    venuePic: row.venue_pic,
    accountNumber: row.account_number,
    rentPeriod: row.rent_period,
    keyAccount: row.key_account,
    noTelpLokasi: row.no_telp_lokasi,
    fotoLokasi: parsePhotoUrls(row.foto_lokasi),
    approval: row.approval,
    awalKontrak: row.awal_kontrak,
    akhirKontrak: row.akhir_kontrak,
    masaKontrak: row.masa_kontrak,
    terminPembayaran: row.termin_pembayaran,
    createdAt: row.created_at,
  }));
}

async function updateSubmission(submissionNo, updates) {
  if (hasDatabaseConfig()) {
    return updateDatabaseSubmission(submissionNo, updates);
  }

  return updateLocalSubmission(submissionNo, updates);
}

async function deleteSubmission(submissionNo) {
  if (hasDatabaseConfig()) {
    return deleteDatabaseSubmission(submissionNo);
  }

  return deleteLocalSubmission(submissionNo);
}

async function deleteDatabaseSubmission(submissionNo) {
  const response = await getDatabasePool().query(
    "DELETE FROM bss_registrations WHERE no = $1",
    [submissionNo],
  );

  return response.rowCount > 0;
}

async function updateDatabaseSubmission(submissionNo, updates) {
  const fieldMap = {
    siteName: (value) => ["site_name", value],
    address: (value) => ["address", value],
    googleMapUrl: (value) => ["google_map_url", value],
    city: (value) => ["city", value],
    province: (value) => ["province", value],
    rentalPrice: (value) => ["rental_price", value],
    jenis: (value) => ["jenis", cleanJenis(value)],
    slot: (value) => ["slot", cleanSlot(value, updates.jenis)],
    venuePic: (value) => ["venue_pic", value],
    accountNumber: (value) => ["account_number", value],
    rentPeriod: (value) => ["rent_period", emptyToNull(value)],
    keyAccount: (value) => ["key_account", value],
    noTelpLokasi: (value) => ["no_telp_lokasi", value],
    approval: (value) => ["approval", value],
    awalKontrak: (value) => ["awal_kontrak", emptyToNull(value)],
    akhirKontrak: (value) => ["akhir_kontrak", emptyToNull(value)],
    masaKontrak: (value) => ["masa_kontrak", emptyToNull(value)],
    terminPembayaran: (value) => ["termin_pembayaran", emptyToNull(value)],
  };

  const entries = Object.entries(updates).map(([field, value]) =>
    fieldMap[field](value),
  );
  const assignments = entries.map(
    ([column], index) => `${column} = $${index + 1}`,
  );
  const values = entries.map(([, value]) => value);

  const response = await getDatabasePool().query(
    `
      UPDATE bss_registrations
      SET ${assignments.join(", ")}
      WHERE no = $${values.length + 1}
      RETURNING no
    `,
    [...values, submissionNo],
  );

  if (response.rowCount === 0) return null;

  return getDatabaseSubmission(submissionNo);
}

async function getDatabaseSubmission(submissionNo) {
  const response = await getDatabasePool().query(
    `
      SELECT
        no,
        site_name,
        address,
        google_map_url,
        city,
        province,
        rental_price,
        jenis,
        slot,
        venue_pic,
        account_number,
        rent_period,
        key_account,
        no_telp_lokasi,
        foto_lokasi,
        approval,
        awal_kontrak,
        akhir_kontrak,
        masa_kontrak,
        termin_pembayaran,
        created_at
      FROM bss_registrations
      WHERE no = $1
      LIMIT 1
    `,
    [submissionNo],
  );

  if (response.rowCount === 0) return null;

  const row = response.rows[0];
  return {
    no: row.no,
    siteName: row.site_name,
    address: row.address,
    googleMapUrl: row.google_map_url,
    city: row.city,
    province: row.province,
    rentalPrice: row.rental_price,
    jenis: row.jenis || "BSS",
    slot: row.slot,
    venuePic: row.venue_pic,
    accountNumber: row.account_number,
    rentPeriod: row.rent_period,
    keyAccount: row.key_account,
    noTelpLokasi: row.no_telp_lokasi,
    fotoLokasi: parsePhotoUrls(row.foto_lokasi),
    approval: row.approval,
    awalKontrak: row.awal_kontrak,
    akhirKontrak: row.akhir_kontrak,
    masaKontrak: row.masa_kontrak,
    terminPembayaran: row.termin_pembayaran,
    createdAt: row.created_at,
  };
}

async function updateLocalSubmission(submissionNo, updates) {
  const existing = await readJsonArray(jsonPath);
  const index = existing.findIndex(
    (submission) => Number(submission.no) === submissionNo,
  );

  if (index === -1) return null;

  existing[index] = {
    ...existing[index],
    ...updates,
  };

  await writeFile(jsonPath, `${JSON.stringify(existing, null, 2)}\n`);

  const csvRows = [
    fields.map(escapeCsv).join(","),
    ...existing.map((submission) =>
      fields.map((field) => escapeCsv(submission[field])).join(","),
    ),
  ];
  await writeFile(csvPath, `${csvRows.join("\n")}\n`);

  return {
    ...existing[index],
    fotoLokasi: parsePhotoUrls(existing[index].fotoLokasi),
    createdAt: "",
  };
}

async function deleteLocalSubmission(submissionNo) {
  const existing = await readJsonArray(jsonPath);
  const nextSubmissions = existing.filter(
    (submission) => Number(submission.no) !== submissionNo,
  );

  if (nextSubmissions.length === existing.length) return false;

  await writeFile(jsonPath, `${JSON.stringify(nextSubmissions, null, 2)}\n`);

  const csvRows = [
    fields.map(escapeCsv).join(","),
    ...nextSubmissions.map((submission) =>
      fields.map((field) => escapeCsv(submission[field])).join(","),
    ),
  ];
  await writeFile(csvPath, `${csvRows.join("\n")}\n`);

  return true;
}

function emptyToNull(value) {
  return value ? value : null;
}

function cleanJenis(value) {
  const jenis = clean(value).toUpperCase();
  if (!["BSS", "EVCS"].includes(jenis)) {
    throw new Error("Jenis tidak valid.");
  }

  return jenis;
}

function isValidCapacity(jenis, value) {
  const normalizedJenis = cleanJenis(jenis || "BSS");
  const allowedSlots = normalizedJenis === "EVCS" ? ["1", "2"] : ["6", "12"];
  return allowedSlots.includes(clean(value));
}

function cleanSlot(value, jenis = "BSS") {
  const normalizedJenis = cleanJenis(jenis || "BSS");

  if (!isValidCapacity(normalizedJenis, value)) {
    throw new Error(
      normalizedJenis === "EVCS"
        ? "Jumlah EVCS tidak valid."
        : "Slot BSS tidak valid.",
    );
  }

  return clean(value);
}

async function getNextSheetNumber(sheets, tabName) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:T`,
  });
  const existingRows = response.data.values || [];
  const filledRows = existingRows.filter((row) =>
    row.some((value) => String(value ?? "").trim()),
  );
  return filledRows.length + 1;
}

async function uploadFilesToGoogleDrive(files) {
  const auth = getGoogleAuth(["https://www.googleapis.com/auth/drive"]);
  const drive = google.drive({ version: "v3", auth });

  return Promise.all(
    files.map(async (file) => {
      const fileName = buildUploadFileName(file.originalname);
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: file.mimetype,
          body: Readable.from(file.buffer),
        },
        fields: "id,name,webViewLink",
        supportsAllDrives: true,
      });

      if (process.env.GOOGLE_DRIVE_PUBLIC_LINKS === "true") {
        await drive.permissions.create({
          fileId: response.data.id,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
          supportsAllDrives: true,
        });
      }

      return {
        fileName: file.originalname,
        filePath: response.data.id,
        fileUrl:
          response.data.webViewLink ||
          `https://drive.google.com/file/d/${response.data.id}/view`,
      };
    }),
  );
}

async function uploadFilesToCloudinary(files) {
  configureCloudinary();

  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: process.env.CLOUDINARY_FOLDER || "foto-site",
              resource_type: "image",
              use_filename: true,
              unique_filename: true,
            },
            (error, result) => {
              if (error) {
                reject(error);
                return;
              }

              resolve({
                fileName: file.originalname,
                filePath: result.public_id,
                fileUrl: result.secure_url,
              });
            },
          );

          Readable.from(file.buffer).pipe(uploadStream);
        }),
    ),
  );
}

function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

async function listBssGalleryImages() {
  configureCloudinary();

  const folder = process.env.CLOUDINARY_BSS_GALLERY_FOLDER || "foto-bss";
  let resources = [];

  try {
    const response = await cloudinary.search
      .expression(`asset_folder="${folder}" AND resource_type:image`)
      .sort_by("created_at", "desc")
      .max_results(30)
      .execute();
    resources = response.resources || [];
  } catch {
    const response = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix: `${folder}/`,
      max_results: 30,
    });
    resources = response.resources || [];
  }

  return resources.map((resource) => ({
    id: resource.public_id,
    title: resource.public_id.split("/").pop()?.replace(/[-_]+/g, " ") || "BSS",
    url: resource.secure_url,
    optimizedUrl: resource.secure_url.replace(
      "/upload/",
      "/upload/f_auto,q_auto,w_900/",
    ),
  }));
}

async function saveFilesLocally(files, req) {
  await mkdir(uploadDir, { recursive: true });

  return Promise.all(
    files.map(async (file) => {
      const fileName = buildUploadFileName(file.originalname);
      const filePath = path.join(uploadDir, fileName);
      const publicPath = `/uploads/${fileName}`;
      const publicUrl = `${req.protocol}://${req.get("host")}${publicPath}`;

      await writeFile(filePath, file.buffer);

      return {
        fileName: file.originalname,
        filePath: publicPath,
        fileUrl: publicUrl,
      };
    }),
  );
}

function buildUploadFileName(originalName) {
  const safeName = originalName
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const extension = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${safeName || "foto-lokasi"}${extension}`;
}

async function ensureSheetHeader(sheets, tabName) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:T1`,
  });

  const existingHeaders = response.data.values?.[0] || [];
  if (existingHeaders.length) return existingHeaders;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1:T1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [sheetHeaders],
    },
  });

  return sheetHeaders;
}

function getColumnName(columnNumber) {
  let columnName = "";
  let current = columnNumber;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    current = Math.floor((current - 1) / 26);
  }

  return columnName || "A";
}
