import axios from 'axios';
import { config } from '../config';
import { OpenWaService } from './openwa.service';
import { LoggerService } from './logger.service';

export class HeartbeatService {
  private static intervalTimer: NodeJS.Timeout | null = null;

  /**
   * Starts the 24/7 background keep-alive ping loop to prevent Render inactivity sleep
   */
  static startKeepAlive(intervalMinutes: number = 8): void {
    if (this.intervalTimer) return;

    const intervalMs = intervalMinutes * 60 * 1000;
    LoggerService.info(`Starting 24/7 Keep-Alive heartbeat service (every ${intervalMinutes} mins)...`, 'HeartbeatService');

    // Run first ping after 15 seconds
    setTimeout(() => this.pingServices(), 15000);

    // Periodic ping loop
    this.intervalTimer = setInterval(() => {
      this.pingServices();
    }, intervalMs);
  }

  /**
   * Pings OpenWA engine and self backend to keep connections warm
   */
  private static async pingServices(): Promise<void> {
    try {
      // 1. Ping OpenWA Engine
      const openWaUrl = await OpenWaService.resolveWorkingUrl(config.openWaGatewayUrl);
      if (openWaUrl) {
        await axios.get(`${openWaUrl}/api/health/ready`, { timeout: 8000 }).catch(() => null);
      }

      // 2. Ping Self Backend (if public URL configured or RENDER_EXTERNAL_URL available)
      const selfUrl = process.env.RENDER_EXTERNAL_URL || config.frontendUrl;
      if (selfUrl && !selfUrl.includes('localhost')) {
        await axios.get(`${selfUrl.replace(/\/+$/, '')}/health`, { timeout: 8000 }).catch(() => null);
      }

      // 3. Memory Guard: log memory and trigger GC if memory exceeds 380MB
      const memory = process.memoryUsage();
      const heapUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
      const rssMb = Math.round(memory.rss / 1024 / 1024);

      if (rssMb > 380) {
        LoggerService.warn(`[Memory Guard] Memory usage: RSS ${rssMb}MB, Heap ${heapUsedMb}MB. Running cleanup...`, 'HeartbeatService');
        if (typeof (global as any).gc === 'function') {
          (global as any).gc();
        }
      }
    } catch {}
  }
}
