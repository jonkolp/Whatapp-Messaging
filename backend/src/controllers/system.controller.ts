import { Request, Response } from 'express';
import { LoggerService } from '../services/logger.service';

export class SystemController {
  static getLogs(req: Request, res: Response): void {
    try {
      const { level, limit = 100 } = req.query;
      const logs = LoggerService.getRecentLogs(level as string, parseInt(limit as string, 10));
      res.json({ success: true, count: logs.length, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static clearLogs(req: Request, res: Response): void {
    try {
      LoggerService.clearLogs();
      res.json({ success: true, message: 'Logs cleared successfully.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
