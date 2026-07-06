import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";
import express from "express";
import { google } from "googleapis";
import multer from "multer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const uploadDir = path.join(rootDir, "uploads");
const jsonPath = path.join(dataDir, "submissions.json");
const csvPath = path.join(dataDir, "submissions.csv");

const app = express();
const port = Number(process.env.PORT || 4444);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const fields = [
  "no",
  "siteName",
  "address",
  "googleMapUrl",
  "city",
  "province",
  "district",
  "subdistrict",
  "rentalPrice",
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
  "District",
  "Subdistrict",
  "Rental Price",
  "Slot",
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

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: getStorageLabel(),
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

    await saveLocal(submission);
    await appendToGoogleSheets(submission);

    res
      .status(201)
      .json({ message: "Terima kasih, respons Anda sudah terkirim." });
  } catch (error) {
    next(error);
  }
});

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
  if (!["6", "12"].includes(formData.slotBss)) {
    errors.push({ field: "slotBss", message: "Slot BSS wajib dipilih." });
  }
  if (!formData.fotoLokasi) {
    errors.push({
      field: "fotoLokasi",
      message: "Foto lokasi wajib diupload.",
    });
  }

  return errors;
}

function clean(value) {
  return String(value ?? "").trim();
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
    no: await getNextLocalNumber(),
    siteName: formData.namaLokasi,
    address: formData.alamat,
    googleMapUrl: formData.googleMapUrl,
    city: formData.kota,
    province: formData.provinsi,
    district: formData.kecamatan,
    subdistrict: formData.kelurahan,
    rentalPrice: "",
    slot: formData.slotBss,
    venuePic: formData.agentPic || "KMB",
    accountNumber: formData.noTelpAgent,
    rentPeriod: "",
    keyAccount: formData.namaPenanggungJawabLokasi,
    noTelpLokasi: formData.noTelpLokasi,
    fotoLokasi: formData.fotoLokasi,
    approval: "",
    awalKontrak: "",
    akhirKontrak: "",
    masaKontrak: "",
    terminPembayaran: "",
  };
}

async function getNextLocalNumber() {
  const existing = await readJsonArray(jsonPath);
  return existing.length + 1;
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

function getStorageLabel() {
  const fileStorage = hasCloudinaryConfig()
    ? "cloudinary"
    : hasDriveConfig()
      ? "google-drive"
      : "local";
  return hasSheetsConfig() ? `${fileStorage}+google-sheets` : fileStorage;
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

async function getNextSheetNumber(sheets, tabName) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:U`,
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
    range: `${tabName}!A1:U1`,
  });

  const existingHeaders = response.data.values?.[0] || [];
  if (existingHeaders.length) return existingHeaders;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1:U1`,
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
