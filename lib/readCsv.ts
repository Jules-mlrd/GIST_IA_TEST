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
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
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
