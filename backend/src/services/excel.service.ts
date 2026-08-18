import ExcelJS from 'exceljs';
import { PhoneService } from './phone.service';

export interface ParsedFileInfo {
  columns: string[];
  totalRows: number;
  sampleRows: Record<string, any>[];
}

export interface ValidatedContactRow {
  rowNumber: number;
  phone: string;
  formattedPhone: string;
  isValidPhone: boolean;
  phoneError?: string;
  customData: Record<string, any>;
  isDuplicate?: boolean;
}

export class ExcelService {
  /**
   * Sanitizes cell values to prevent formula injection (=,+,-,@)
   */
  private static sanitizeCellValue(val: any): any {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if (val.text) return this.sanitizeCellValue(val.text);
      if (val.result) return this.sanitizeCellValue(val.result);
      return JSON.stringify(val);
    }
    const str = String(val).trim();
    // Only escape true formula injections (=, @, or + followed by letters), preserve international phones like +966... or +1...
    if (str.startsWith('=') || str.startsWith('@')) {
      return `'${str}`;
    }
    if ((str.startsWith('+') || str.startsWith('-')) && !/^[+-]\d+/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Inspects uploaded Excel file and extracts column headers and sample data
   */
  static async inspectFile(filePath: string): Promise<ParsedFileInfo> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 1) {
      throw new Error('The uploaded Excel file contains no worksheets or data.');
    }

    const columns: string[] = [];
    const headerRow = worksheet.getRow(1);
    
    headerRow.eachCell((cell, colNumber) => {
      const colName = String(cell.value || `Column_${colNumber}`).trim();
      columns.push(colName);
    });

    if (columns.length === 0) {
      throw new Error('No valid column headers found in the first row.');
    }

    const sampleRows: Record<string, any>[] = [];
    const maxSample = Math.min(worksheet.rowCount, 6);

    for (let r = 2; r <= maxSample; r++) {
      const row = worksheet.getRow(r);
      if (!row || !row.hasValues) continue;

      const rowObj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        const cell = row.getCell(idx + 1);
        rowObj[col] = this.sanitizeCellValue(cell.value);
      });
      sampleRows.push(rowObj);
    }

    return {
      columns,
      totalRows: Math.max(0, worksheet.rowCount - 1),
      sampleRows
    };
  }

  /**
   * Parses all rows from the file using the user-defined column mapping
   */
  static async parseAndValidate(
    filePath: string,
    columnMapping: { phoneColumn: string; [key: string]: string }
  ): Promise<{
    validRows: ValidatedContactRow[];
    invalidRows: ValidatedContactRow[];
    totalRows: number;
    duplicateCount: number;
  }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    const headerRow = worksheet.getRow(1);
    const headerIndexMap: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const name = String(cell.value || '').trim();
      if (name) headerIndexMap[name] = colNumber;
    });

    const phoneColIndex = headerIndexMap[columnMapping.phoneColumn];
    if (!phoneColIndex) {
      throw new Error(`Mapped phone column "${columnMapping.phoneColumn}" not found in sheet headers.`);
    }

    const validRows: ValidatedContactRow[] = [];
    const invalidRows: ValidatedContactRow[] = [];
    const seenPhones = new Set<string>();
    let duplicateCount = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rawPhoneVal = this.sanitizeCellValue(row.getCell(phoneColIndex).value);
      const validation = PhoneService.validateAndFormat(rawPhoneVal);

      // Extract custom mapped fields
      const customData: Record<string, any> = {};
      for (const [targetKey, sourceCol] of Object.entries(columnMapping)) {
        if (targetKey === 'phoneColumn') continue;
        const colIdx = headerIndexMap[sourceCol];
        if (colIdx) {
          customData[targetKey] = this.sanitizeCellValue(row.getCell(colIdx).value);
        }
      }

      const rowResult: ValidatedContactRow = {
        rowNumber,
        phone: String(rawPhoneVal),
        formattedPhone: validation.e164,
        isValidPhone: validation.isValid,
        phoneError: validation.error,
        customData
      };

      if (!validation.isValid) {
        invalidRows.push(rowResult);
      } else {
        if (seenPhones.has(validation.e164)) {
          rowResult.isDuplicate = true;
          duplicateCount++;
        } else {
          seenPhones.add(validation.e164);
        }
        validRows.push(rowResult);
      }
    });

    return {
      validRows,
      invalidRows,
      totalRows: validRows.length + invalidRows.length,
      duplicateCount
    };
  }
}
