import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { ExcelService } from '../services/excel.service';

export class FileController {
  static async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: 'No Excel file uploaded.' });
        return;
      }

      // Inspect headers & sample rows
      const inspection = await ExcelService.inspectFile(file.path);
      const fileId = uuidv4();

      db.prepare(`
        INSERT INTO uploaded_files (id, user_id, file_name, storage_path, file_size_bytes, row_count, detected_columns)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        req.user?.id,
        file.originalname,
        file.path,
        file.size,
        inspection.totalRows,
        JSON.stringify(inspection.columns)
      );

      res.status(201).json({
        success: true,
        message: 'File uploaded and inspected successfully.',
        file: {
          id: fileId,
          fileName: file.originalname,
          fileSizeBytes: file.size,
          rowCount: inspection.totalRows,
          detectedColumns: inspection.columns,
          sampleRows: inspection.sampleRows
        }
      });
    } catch (err: any) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: err.message || 'File processing failed.' });
    }
  }

  static async previewMapping(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { columnMapping } = req.body;

      if (!columnMapping || !columnMapping.phoneColumn) {
        res.status(400).json({ success: false, message: 'columnMapping with phoneColumn is required.' });
        return;
      }

      const fileRecord: any = db.prepare('SELECT * FROM uploaded_files WHERE id = ? AND user_id = ?').get(id, req.user?.id);
      if (!fileRecord) {
        res.status(404).json({ success: false, message: 'Uploaded file not found.' });
        return;
      }

      if (!fs.existsSync(fileRecord.storage_path)) {
        res.status(404).json({ success: false, message: 'Physical file not found on disk.' });
        return;
      }

      const parsed = await ExcelService.parseAndValidate(fileRecord.storage_path, columnMapping);

      res.json({
        success: true,
        summary: {
          totalRows: parsed.totalRows,
          validCount: parsed.validRows.length,
          invalidCount: parsed.invalidRows.length,
          duplicateCount: parsed.duplicateCount
        },
        validPreview: parsed.validRows.slice(0, 10),
        invalidPreview: parsed.invalidRows.slice(0, 10)
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async listFiles(req: Request, res: Response): Promise<void> {
    try {
      const files = db.prepare('SELECT id, file_name, file_size_bytes, row_count, detected_columns, created_at FROM uploaded_files WHERE user_id = ? ORDER BY created_at DESC').all(req.user?.id);
      res.json({ success: true, files });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const fileRecord: any = db.prepare('SELECT storage_path FROM uploaded_files WHERE id = ? AND user_id = ?').get(id, req.user?.id);
      if (!fileRecord) {
        res.status(404).json({ success: false, message: 'File not found.' });
        return;
      }
      if (fs.existsSync(fileRecord.storage_path)) {
        try { fs.unlinkSync(fileRecord.storage_path); } catch {}
      }
      db.prepare('DELETE FROM uploaded_files WHERE id = ? AND user_id = ?').run(id, req.user?.id);
      res.json({ success: true, message: 'File deleted successfully.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
