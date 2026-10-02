import "dotenv/config";
import { google } from "googleapis";
import pg from "pg";

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

const dbColumns = [
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
const legacySheetHeaders = sheetHeaders
  .filter((header) => header !== "Jenis")
  .map((header) => (header === "Slot / Jumlah EVCS" ? "Slot" : header));

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} belum diisi di .env`);
  }
  return process.env[name];
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanRowNumber(value) {
  const number = Number(clean(value));
  return Number.isInteger(number) && number > 0 ? number : null;
}

function cleanJenis(value) {
  const jenis = clean(value).toUpperCase();
  return ["BSS", "EVCS"].includes(jenis) ? jenis : "BSS";
}

function cleanSlot(value, jenis = "BSS") {
  const allowedSlots = jenis === "EVCS" ? ["1", "2"] : ["6", "12"];
  const slot = clean(value).match(/\b(1|2|6|12)\b/)?.[1] || clean(value);
  return allowedSlots.includes(slot) ? slot : "";
}

function normalizeRow(row, fallbackNumber) {
  const normalizedRow = normalizeImportCells(row);
  const paddedRow = sheetHeaders.map((_, index) => clean(normalizedRow[index]));
  const values = Object.fromEntries(
    dbColumns.map((column, index) => [column, paddedRow[index] || ""]),
  );

  values.no = cleanRowNumber(values.no) || fallbackNumber;
  values.jenis = cleanJenis(values.jenis);
  values.slot = cleanSlot(values.slot, values.jenis);

  return values;
}

function normalizeImportCells(row) {
  if (row.length === sheetHeaders.length - 1) {
    const normalizedRow = [...row];
    normalizedRow.splice(sheetHeaders.indexOf("Jenis"), 0, "BSS");
    return normalizedRow;
  }

  return row;
}

function isEmptyRow(row) {
  return row.every((value) => !clean(value));
}

function getGoogleAuth() {
  return new google.auth.JWT({
    email: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function getDatabasePool() {
  return new pg.Pool({
    connectionString: requireEnv("DATABASE_URL"),
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

async function readRowsFromSheet() {
  const spreadsheetId = requireEnv("GOOGLE_SHEETS_ID");
  const tabName = process.env.GOOGLE_SHEETS_TAB || "db_registrasi";
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:T`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) return [];

  const firstRow = rows[0].map(clean);
  const hasHeader = sheetHeaders.every(
    (header, index) => firstRow[index] === header,
  );
  const hasLegacyHeader = legacySheetHeaders.every(
    (header, index) => firstRow[index] === header,
  );

  return hasHeader || hasLegacyHeader ? rows.slice(1) : rows;
}

async function upsertRows(pool, rows) {
  const insertColumns = dbColumns.join(", ");
  const placeholders = dbColumns.map((_, index) => `$${index + 1}`).join(", ");
  const updateColumns = dbColumns
    .filter((column) => column !== "no")
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  let imported = 0;
  let skipped = 0;

  for (const [index, rawRow] of rows.entries()) {
    if (isEmptyRow(rawRow)) {
      skipped += 1;
      continue;
    }

    const row = normalizeRow(rawRow, index + 1);
    if (!row.slot) {
      skipped += 1;
      console.warn(`Lewati baris ${index + 2}: Slot harus 6 atau 12.`);
      continue;
    }

    await pool.query(
      `
        INSERT INTO bss_registrations (${insertColumns})
        VALUES (${placeholders})
        ON CONFLICT (no) DO UPDATE SET ${updateColumns}
      `,
      dbColumns.map((column) => row[column]),
    );
    imported += 1;
  }

  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('bss_registrations', 'no'),
      COALESCE((SELECT MAX(no) FROM bss_registrations), 1),
      true
    )
  `);

  return { imported, skipped };
}

async function main() {
  const rows = await readRowsFromSheet();
  const pool = getDatabasePool();

  try {
    const result = await upsertRows(pool, rows);
    console.log(
      `Import selesai. Masuk/update: ${result.imported}. Dilewati: ${result.skipped}.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
