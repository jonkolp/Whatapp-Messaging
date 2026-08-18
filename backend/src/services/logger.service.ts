import fs from 'fs';
import path from 'path';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  context?: string;
  stack?: string;
  details?: any;
}

const logsDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const errorLogPath = path.join(logsDir, 'error.log');
const combinedLogPath = path.join(logsDir, 'combined.log');

export class LoggerService {
  private static recentLogs: LogEntry[] = [];
  private static MAX_BUFFER_SIZE = 500;

  private static formatLog(entry: LogEntry): string {
    const contextStr = entry.context ? ` [${entry.context}]` : '';
    const detailsStr = entry.details ? ` | Details: ${JSON.stringify(entry.details)}` : '';
    const stackStr = entry.stack ? `\nStack: ${entry.stack}` : '';
    return `[${entry.timestamp}] [${entry.level}]${contextStr} ${entry.message}${detailsStr}${stackStr}\n`;
  }

  private static appendToFile(filePath: string, text: string) {
    fs.appendFile(filePath, text, (err) => {
      if (err) {
        console.error('Failed to write to log file:', err);
      }
    });
  }

  static error(message: string, context?: string, errorObj?: any, details?: any): void {
    const timestamp = new Date().toISOString();
    const stack = errorObj instanceof Error ? errorObj.stack : typeof errorObj === 'string' ? errorObj : undefined;
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      level: 'ERROR',
      message,
      context,
      stack,
      details: details || (errorObj instanceof Error ? undefined : errorObj)
    };

    // Keep in in-memory ring buffer
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > this.MAX_BUFFER_SIZE) {
      this.recentLogs.pop();
    }

    const formatted = this.formatLog(entry);
    console.error(`\x1b[31m${formatted.trim()}\x1b[0m`);
    this.appendToFile(errorLogPath, formatted);
    this.appendToFile(combinedLogPath, formatted);
  }

  static warn(message: string, context?: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      level: 'WARN',
      message,
      context,
      details
    };

    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > this.MAX_BUFFER_SIZE) {
      this.recentLogs.pop();
    }

    const formatted = this.formatLog(entry);
    console.warn(`\x1b[33m${formatted.trim()}\x1b[0m`);
    this.appendToFile(combinedLogPath, formatted);
  }

  static info(message: string, context?: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      level: 'INFO',
      message,
      context,
      details
    };

    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > this.MAX_BUFFER_SIZE) {
      this.recentLogs.pop();
    }

    const formatted = this.formatLog(entry);
    console.log(formatted.trim());
    this.appendToFile(combinedLogPath, formatted);
  }

  static getRecentLogs(level?: string, limit: number = 100): LogEntry[] {
    let filtered = this.recentLogs;
    if (level && level !== 'ALL') {
      filtered = filtered.filter(l => l.level === level);
    }
    return filtered.slice(0, limit);
  }

  static clearLogs(): void {
    this.recentLogs = [];
    try {
      if (fs.existsSync(errorLogPath)) fs.writeFileSync(errorLogPath, '');
      if (fs.existsSync(combinedLogPath)) fs.writeFileSync(combinedLogPath, '');
    } catch (e) {
      console.error(e);
    }
  }
}
