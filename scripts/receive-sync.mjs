import fs from "node:fs/promises";
import path from "node:path";

const syncId = process.env.SYNC_ID || "";
const index = Number(process.env.CHUNK_INDEX);
const total = Number(process.env.CHUNK_TOTAL);
const chunk = process.env.CHUNK_DATA || "";

if (!/^[A-Za-z0-9_-]{6,80}$/.test(syncId)) throw new Error("SYNC_ID inválido");
if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total < 1 || index >= total || total > 30) throw new Error("Índice de fragmento inválido");
if (!chunk || chunk.length > 60000) throw new Error("Contenido de fragmento inválido");

const syncDir = path.join(".sync", syncId);
await fs.mkdir(syncDir, { recursive: true });
await fs.writeFile(path.join(syncDir, `${String(index).padStart(3, "0")}.part`), chunk, "utf8");

const parts = await fs.readdir(syncDir);
if (parts.filter((name) => name.endsWith(".part")).length !== total) {
  console.log(JSON.stringify({ syncId, received: index + 1, total, complete: false }));
  process.exit(0);
}

let serialized = "";
for (let part = 0; part < total; part += 1) {
  serialized += await fs.readFile(path.join(syncDir, `${String(part).padStart(3, "0")}.part`), "utf8");
}

const source = JSON.parse(serialized);
let previous = {};
try {
  previous = JSON.parse(await fs.readFile("plan-data.json", "utf8"));
} catch {
  previous = {};
}

const plain = (value) => String(value ?? "").trim();
const isSystemField = (value) => {
  const field = plain(value);
  return field.startsWith("@") || field === "ItemInternalId";
};
const normalizeHeader = (value, column) => {
  const header = plain(value);
  if (/^indicadores?$/i.test(header)) return "Indicador";
  return header || (column === 3 ? "Indicador" : `Columna ${column + 1}`);
};
const excelDateToIso = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 1000 && numeric < 100000) {
    return new Date(Date.UTC(1899, 11, 30) + numeric * 86400000).toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toISOString().slice(0, 10);
};

let originalHeaders;
let headers;
let rawRecords;
let sourceName;
let sheetName;
let range;
let generatedAt;
let formulaIssue;
let holidays;

if (Array.isArray(source)) {
  rawRecords = source.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  if (!rawRecords.length) throw new Error("La tabla del Excel no contiene filas válidas");
  originalHeaders = Object.keys(rawRecords[0]).filter((header) => !isSystemField(header));
  headers = originalHeaders.map(normalizeHeader);
  sourceName = previous.metadata?.sourceName || "Plan_de_Mejoras_Acreditacion_Andina_D1514(3).xlsx";
  sheetName = previous.metadata?.sheetName || "Plan de Mejoras";
  range = "Tabla PlanMejoras";
  generatedAt = new Date().toISOString();
  formulaIssue = previous.metadata?.formulaIssue || null;
  holidays = Array.isArray(previous.holidays) ? previous.holidays : [];
} else if (Array.isArray(source.values) && source.values.length >= 2 && Array.isArray(source.values[0])) {
  const sourceHeaders = source.values[0].map((value) => plain(value));
  originalHeaders = sourceHeaders.filter((header) => !isSystemField(header));
  headers = originalHeaders.map((header) => normalizeHeader(header, sourceHeaders.indexOf(header)));
  rawRecords = source.values.slice(1).map((row) => Object.fromEntries(originalHeaders.map((header) => {
    const column = sourceHeaders.indexOf(header);
    return [header, row[column] ?? null];
  })));
  sourceName = source.sourceName || "Plan_de_Mejoras_Acreditacion_Andina_D1514(3).xlsx";
  sheetName = source.sheetName || "Plan de Mejoras";
  range = source.range || "";
  generatedAt = source.generatedAt || new Date().toISOString();
  formulaIssue = source.formulaIssue || null;
  holidays = Array.isArray(source.holidays) ? source.holidays : [];
} else {
  throw new Error("Los datos recibidos desde Power Automate no son válidos");
}

const records = rawRecords
  .map((row, rowIndex) => ({ row, rowIndex }))
  .filter(({ row }) => originalHeaders.some((header) => row[header] !== null && row[header] !== ""))
  .map(({ row, rowIndex }) => {
    const record = { _excelRow: rowIndex + 2 };
    originalHeaders.forEach((originalHeader, column) => { record[headers[column]] = row[originalHeader] ?? null; });
    record["Fecha de inicio"] = excelDateToIso(record["Fecha de inicio"]);
    record["Fecha de fin"] = excelDateToIso(record["Fecha de fin"]);
    record["Avance (%)"] = Number.isFinite(Number(record["Avance (%)"])) ? Number(record["Avance (%)"]) : 0;
    return record;
  });

const dates = records.flatMap((record) => [record["Fecha de inicio"], record["Fecha de fin"]]).filter(Boolean).sort();
const ids = records.map((record) => plain(record.ID)).filter(Boolean);
const duplicateIds = [...new Set(ids.filter((id, position) => ids.indexOf(id) !== position))];
const result = {
  metadata: {
    sourceName,
    sheetName,
    range,
    generatedAt,
    totalActivities: records.length,
    totalColumns: headers.length,
    minDate: dates[0] || null,
    maxDate: dates.at(-1) || null,
    duplicateIds,
    blankHeaderColumns: originalHeaders.map((header, column) => header ? null : column + 1).filter(Boolean),
    formulaIssue,
  },
  headers,
  originalHeaders,
  holidays,
  records,
};

await fs.writeFile("plan-data.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
await fs.rm(".sync", { recursive: true, force: true });
console.log(JSON.stringify({ syncId, complete: true, records: records.length, columns: headers.length }));
