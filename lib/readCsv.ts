import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Detects file type and parses CSV or Excel content.
 * @param fileBuffer Buffer of the uploaded file
 * @param fileName Name of the file (to detect extension)
 * @returns Parsed data as JSON or error object
 */
export async function parseStructuredFile(
  fileBuffer: Buffer,
  fileName: string
): Promise<{ data?: any; summary?: string; error?: string }> {
  try {
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      // Parse CSV
      const csvText = fileBuffer.toString("utf8");
      const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      if (result.errors.length) {
        return { error: "Erreur lors du parsing CSV: " + result.errors[0].message };
      }
      return {
        data: result.data,
        summary: summarizeTable(result.data),
      };
    }

    if (ext === "xlsx" || ext === "xls") {
      // Parse Excel
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // Détection automatique de la zone utile (ignorer lignes/colonnes vides)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      let minRow = range.s.r, maxRow = range.e.r, minCol = range.s.c, maxCol = range.e.c;
      // Chercher la première ligne non vide
      outer: for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v !== undefined && cell.v !== null && cell.v !== "") {
            minRow = r; minCol = c; break outer;
          }
        }
      }
      // Chercher la dernière ligne/colonne non vide
      for (let r = range.e.r; r >= minRow; r--) {
        for (let c = range.e.c; c >= minCol; c--) {
          const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v !== undefined && cell.v !== null && cell.v !== "") {
            maxRow = r; maxCol = c; break;
          }
        }
        if (maxRow !== range.e.r) break;
      }
      // Redéfinir la zone utile
      const usefulRange = XLSX.utils.encode_range({ s: { r: minRow, c: minCol }, e: { r: maxRow, c: maxCol } });
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null, range: usefulRange });
      return {
        data: jsonData,
        summary: summarizeTable(jsonData),
      };
    }

    return { error: "Format de fichier non supporté. Seuls les fichiers .csv, .xlsx, .xls sont acceptés." };
  } catch (err: any) {
    return { error: "Erreur lors de la lecture du fichier: " + (err.message || "Erreur inconnue") };
  }
}

/**
 * Generates a simple summary of a table (number of rows, columns, and column names)
 */
function summarizeTable(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) return "Aucune donnée trouvée dans le fichier.";
  const columns = Object.keys(data[0]);
  return `Le fichier contient ${data.length} lignes et ${columns.length} colonnes : ${columns.join(", ")}.`;
}
