import axios from 'axios';
import QRCode from 'qrcode';
import { io as ioClient, Socket } from 'socket.io-client';
import { LoggerService } from './logger.service';
import { PhoneService } from './phone.service';
import { config } from '../config';

export interface OpenWaHealthResult {
  isOnline: boolean;
  gatewayUrl: string;
  isAuthenticated: boolean;
  status: 'ONLINE_AUTHENTICATED' | 'ONLINE_WAITING_FOR_QR' | 'OFFLINE';
  phoneNumber?: string;
  details?: string;
  error?: string;
  sessions?: any[];
}

export interface OpenWaQrResult {
  success: boolean;
  gatewayUrl: string;
  qrDataUrl?: string;
  rawQr?: string;
  isAuthenticated?: boolean;
  sessionId?: string;
  sessionName?: string;
  phoneNumber?: string;
  error?: string;
  session?: any;
}

export class OpenWaService {
  private static latestQrDataUrl: string | null = null;
  private static latestQrTimestamp: number = 0;
  private static activeSocket: Socket | null = null;
  private static connectedSocketUrl: string | null = null;

  // Known / candidate API keys for OpenWA
  private static knownApiKeys: string[] = [
    process.env.OPENWA_API_KEY || '',
    'owa_k1_b6e2f42630ded3c45ea5438417bec7576b5b25e950e21ea145f4eb089e2076a7',
    'openwa_master_key_12345678'
  ].filter(Boolean);

  static addApiKey(key: string) {
    if (key && !this.knownApiKeys.includes(key)) {
      this.knownApiKeys.unshift(key);
    }
  }

  /**
   * Generates candidate target URLs to handle port 2785 (OpenWA backend/dashboard),
   * port 2886, port 8080, Docker networks, and localhost.
   */
  private static getCandidateUrls(primaryUrl: string = 'http://localhost:2785'): string[] {
    const cleanPrimary = (primaryUrl || 'http://localhost:2785').replace(/\/+$/, '');
    const set = new Set<string>();
    
    // 1. Primary requested URL
    set.add(cleanPrimary);
    
    // 2. Configured URL from ENV
    if (config.openWaGatewayUrl) {
      set.add(config.openWaGatewayUrl.replace(/\/+$/, ''));
    }

    // 3. OpenWA port 2785 (Default API & Dashboard port)
    set.add('http://localhost:2785');
    set.add('http://127.0.0.1:2785');
    set.add('http://host.docker.internal:2785');
    set.add('http://openwa-api:2785');

    // 4. OpenWA port 2886 (Vite dev port)
    set.add('http://localhost:2886');
    set.add('http://127.0.0.1:2886');
    set.add('http://host.docker.internal:2886');

    // 5. Classic open-wa port 8080
    set.add('http://localhost:8080');
    set.add('http://127.0.0.1:8080');
    set.add('http://host.docker.internal:8080');
    set.add('http://openwa:8080');

    return Array.from(set);
  }

  /**
   * Builds headers with candidate API keys
   */
  private static getHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.knownApiKeys[0] || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (key) {
      headers['x-api-key'] = key;
      headers['Authorization'] = `Bearer ${key}`;
    }
    return headers;
  }

  /**
   * Finds the first active, reachable open-wa URL among all candidates
   */
  static async resolveWorkingUrl(requestedUrl: string = 'http://localhost:2785'): Promise<string | null> {
    const candidates = this.getCandidateUrls(requestedUrl);

    for (const url of candidates) {
      try {
        const res = await axios.get(`${url}/`, { timeout: 1500 });
        if (res.status >= 200 && res.status < 500) {
          this.ensureSocketListener(url);
          return url;
        }
      } catch (err: any) {
        if (err.response && err.response.status) {
          this.ensureSocketListener(url);
          return url;
        }
      }
    }

    return null;
  }

  /**
   * Attaches a live Socket.IO listener to OpenWA to capture real-time QR broadcasts
   */
  private static ensureSocketListener(url: string) {
    if (this.activeSocket && this.connectedSocketUrl === url) {
      return;
    }

    if (this.activeSocket) {
      try {
        this.activeSocket.disconnect();
      } catch {}
    }

    try {
      this.connectedSocketUrl = url;
      this.activeSocket = ioClient(url, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        timeout: 5000,
        transports: ['websocket', 'polling'],
        auth: {
          token: this.knownApiKeys[0] || undefined
        }
      });

      this.activeSocket.on('qr', async (data: any) => {
        try {
          const qrString = typeof data === 'string' ? data : data?.qrCode || data?.qr || data?.code;
          if (qrString) {
            if (qrString.startsWith('data:image/')) {
              this.latestQrDataUrl = qrString;
            } else {
              this.latestQrDataUrl = await QRCode.toDataURL(qrString, {
                errorCorrectionLevel: 'H',
                margin: 2,
                width: 320
              });
            }
            this.latestQrTimestamp = Date.now();
          }
        } catch {}
      });

      this.activeSocket.on('session-qr', async (data: any) => {
        try {
          const qrString = typeof data === 'string' ? data : data?.qrCode || data?.qr || data?.code;
          if (qrString) {
            if (qrString.startsWith('data:image/')) {
              this.latestQrDataUrl = qrString;
            } else {
              this.latestQrDataUrl = await QRCode.toDataURL(qrString, {
                errorCorrectionLevel: 'H',
                margin: 2,
                width: 320
              });
            }
            this.latestQrTimestamp = Date.now();
          }
        } catch {}
      });
    } catch {}
  }

  /**
   * Lists all sessions currently configured in OpenWA
   */
  static async listSessions(gatewayUrl: string = 'http://localhost:2785'): Promise<any[]> {
    const workingUrl = (await this.resolveWorkingUrl(gatewayUrl)) || gatewayUrl.replace(/\/+$/, '');
    for (const key of this.knownApiKeys) {
      try {
        const res = await axios.get(`${workingUrl}/api/sessions`, {
          headers: this.getHeaders(key),
          timeout: 3500
        });
        if (Array.isArray(res.data)) {
          return res.data;
        }
      } catch {}
    }
    return [];
  }

  /**
   * Creates a new session in OpenWA and starts its engine
   */
  static async createSession(gatewayUrl: string = 'http://localhost:2785', sessionName: string = 'session'): Promise<any> {
    const workingUrl = (await this.resolveWorkingUrl(gatewayUrl)) || gatewayUrl.replace(/\/+$/, '');
    for (const key of this.knownApiKeys) {
      const headers = this.getHeaders(key);
      try {
        const res = await axios.post(`${workingUrl}/api/sessions`, { name: sessionName }, { headers, timeout: 5000 });
        if (res.data && res.data.id) {
          try {
            await axios.post(`${workingUrl}/api/sessions/${res.data.id}/start`, {}, { headers, timeout: 5000 });
          } catch {}
          return res.data;
        }
      } catch (err: any) {
        if (err.response?.data?.message) {
          throw new Error(err.response.data.message);
        }
      }
    }
    throw new Error('Failed to create session in OpenWA');
  }

  /**
   * Deletes / removes a session from OpenWA and cleans up session files
   */
  static async deleteSession(gatewayUrl: string = 'http://localhost:2785', sessionId: string): Promise<boolean> {
    const workingUrl = (await this.resolveWorkingUrl(gatewayUrl)) || gatewayUrl.replace(/\/+$/, '');
    for (const key of this.knownApiKeys) {
      const headers = this.getHeaders(key);
      try {
        // Try logout first
        try {
          await axios.post(`${workingUrl}/api/sessions/${sessionId}/logout`, {}, { headers, timeout: 4000 });
        } catch {}
        // Then delete
        await axios.delete(`${workingUrl}/api/sessions/${sessionId}`, { headers, timeout: 5000 });
        return true;
      } catch {}
    }
    return false;
  }

  /**
   * Restarts a session in OpenWA
   */
  static async restartSession(gatewayUrl: string = 'http://localhost:2785', sessionId: string): Promise<any> {
    const workingUrl = (await this.resolveWorkingUrl(gatewayUrl)) || gatewayUrl.replace(/\/+$/, '');
    for (const key of this.knownApiKeys) {
      const headers = this.getHeaders(key);
      try {
        const res = await axios.post(`${workingUrl}/api/sessions/${sessionId}/restart`, {}, { headers, timeout: 5000 });
        return res.data;
      } catch {
        try {
          const resStart = await axios.post(`${workingUrl}/api/sessions/${sessionId}/start`, {}, { headers, timeout: 5000 });
          return resStart.data;
        } catch {}
      }
    }
    return null;
  }

  /**
   * Verifies health status of the open-wa instance and returns active sessions
   */
  static async checkHealth(gatewayUrl: string = 'http://localhost:2785'): Promise<OpenWaHealthResult> {
    const workingUrl = await this.resolveWorkingUrl(gatewayUrl);

    if (!workingUrl) {
      return {
        isOnline: false,
        gatewayUrl,
        isAuthenticated: false,
        status: 'OFFLINE',
        error: `Could not connect to OpenWA service at ${gatewayUrl} (checked ports 2785, 2886, and 8080).`
      };
    }

    let isAuth = false;
    let phone: string | undefined = undefined;
    let sessions: any[] = [];

    // 1. Check OpenWA sessions endpoint with candidate API keys
    for (const key of this.knownApiKeys) {
      try {
        const sessionsRes = await axios.get(`${workingUrl}/api/sessions`, {
          headers: this.getHeaders(key),
          timeout: 2500
        });
        if (Array.isArray(sessionsRes.data)) {
          sessions = sessionsRes.data;
          const active = sessions.find((s: any) =>
            s.status === 'ready' || s.status === 'authenticated' || s.status === 'connected' || s.phone
          );
          if (active) {
            isAuth = true;
            phone = active.phone || active.phoneNumber || active.me?.user;
          }
          break;
        }
      } catch {}
    }

    // 2. Check classic endpoints: /api/session/is-authenticated
    if (!isAuth) {
      try {
        const authRes = await axios.get(`${workingUrl}/api/session/is-authenticated`, { timeout: 2500 });
        isAuth = Boolean(authRes.data === true || authRes.data?.authenticated === true);
      } catch {}
    }

    return {
      isOnline: true,
      gatewayUrl: workingUrl,
      isAuthenticated: isAuth,
      status: isAuth ? 'ONLINE_AUTHENTICATED' : 'ONLINE_WAITING_FOR_QR',
      phoneNumber: phone,
      sessions,
      details: isAuth
        ? `OpenWA is online at ${workingUrl} with ${sessions.length} session(s) (${isAuth ? 'Authenticated' : 'Waiting for QR'}).`
        : `OpenWA is online and ready for QR scan at ${workingUrl}.`
    };
  }

  /**
   * Fetches the dynamic QR code for a specific session or creates a new session in OpenWA
   */
  static async fetchLiveQr(options: {
    gatewayUrl?: string;
    sessionName?: string;
    sessionId?: string;
    forceNew?: boolean;
  } | string = 'http://localhost:2785'): Promise<OpenWaQrResult> {
    const opts = typeof options === 'string' ? { gatewayUrl: options } : options;
    const requestedUrl = opts.gatewayUrl || 'http://localhost:2785';
    const workingUrl = await this.resolveWorkingUrl(requestedUrl);

    if (!workingUrl) {
      return {
        success: false,
        gatewayUrl: requestedUrl,
        error: `Could not connect to OpenWA service at ${requestedUrl} (checked ports 2785, 2886, and 8080).`
      };
    }

    let targetSession: any = null;
    const apiKey = this.knownApiKeys[0] || '';
    const headers = this.getHeaders(apiKey);

    // 1. Fetch current sessions list from OpenWA
    let allSessions: any[] = [];
    try {
      const listRes = await axios.get(`${workingUrl}/api/sessions`, { headers, timeout: 3500 });
      if (Array.isArray(listRes.data)) {
        allSessions = listRes.data;
      }
    } catch {}

    // 2. Identify or Create Target Session
    if (opts.sessionId) {
      targetSession = allSessions.find(s => s.id === opts.sessionId);
    } else if (opts.sessionName && !opts.forceNew) {
      targetSession = allSessions.find(s => s.name?.toLowerCase() === opts.sessionName?.toLowerCase());
    }

    // If forceNew requested or sessionName explicitly provided and not found
    if ((opts.forceNew || (!targetSession && opts.sessionName)) && (!opts.sessionId)) {
      try {
        const newName = opts.sessionName || `session-${Date.now()}`;
        const createRes = await axios.post(`${workingUrl}/api/sessions`, { name: newName }, { headers, timeout: 5000 });
        if (createRes.data?.id) {
          targetSession = createRes.data;
          allSessions.push(targetSession);
        }
      } catch (err: any) {
        LoggerService.warn(`Failed creating new session in OpenWA: ${err.message}`, 'OpenWaService.fetchLiveQr');
      }
    }

    // If still no target session, look for unauthenticated/waiting session, or fallback to first
    if (!targetSession) {
      if (allSessions.length === 0) {
        // Create initial session
        try {
          const createRes = await axios.post(`${workingUrl}/api/sessions`, { name: 'baileys-active' }, { headers, timeout: 5000 });
          if (createRes.data?.id) {
            targetSession = createRes.data;
          }
        } catch {}
      } else {
        // Pick waiting session first if available
        const waiting = allSessions.find(s => s.status === 'created' || s.status === 'disconnected' || !s.phone);
        targetSession = waiting || allSessions[0];
      }
    }

    if (!targetSession) {
      return {
        success: false,
        gatewayUrl: workingUrl,
        error: 'Unable to initialize OpenWA session container.'
      };
    }

    // 3. Check if target session is already authenticated
    if (targetSession.status === 'ready' || (targetSession.phone && targetSession.status !== 'disconnected' && targetSession.engineLoaded)) {
      return {
        success: true,
        gatewayUrl: workingUrl,
        isAuthenticated: true,
        sessionId: targetSession.id,
        sessionName: targetSession.name,
        phoneNumber: targetSession.phone || undefined,
        session: targetSession
      };
    }

    // 4. Ensure session engine is started in OpenWA
    try {
      if (!targetSession.engineLoaded || targetSession.status === 'disconnected' || targetSession.status === 'created') {
        await axios.post(`${workingUrl}/api/sessions/${targetSession.id}/start`, {}, { headers, timeout: 6000 });
      }
    } catch {}

    // 5. Query live QR for this target session
    let qrDataUrl: string | null = null;
    let rawQrString: string | null = null;

    // Retry up to 3 times with brief delays (Baileys may take 1-2s to emit QR on fresh start)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const qrRes = await axios.get(`${workingUrl}/api/sessions/${targetSession.id}/qr`, { headers, timeout: 3500 });
        if (qrRes.data?.qrCode) {
          qrDataUrl = qrRes.data.qrCode;
          break;
        } else if (qrRes.data?.qr) {
          rawQrString = qrRes.data.qr;
          break;
        }
      } catch (err: any) {
        // If engine just initialized, wait 800ms and retry
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    }

    // Fallback: check cached Socket.IO QR if freshly received
    if (!qrDataUrl && !rawQrString && this.latestQrDataUrl && (Date.now() - this.latestQrTimestamp) < 45000) {
      qrDataUrl = this.latestQrDataUrl;
    }

    // Convert raw QR string to Data URL if needed
    if (!qrDataUrl && rawQrString) {
      if (rawQrString.startsWith('data:image/')) {
        qrDataUrl = rawQrString;
      } else {
        qrDataUrl = await QRCode.toDataURL(rawQrString, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 320
        });
      }
    }

    if (qrDataUrl) {
      this.latestQrDataUrl = qrDataUrl;
      this.latestQrTimestamp = Date.now();
    }

    return {
      success: true,
      gatewayUrl: workingUrl,
      qrDataUrl: qrDataUrl || undefined,
      rawQr: rawQrString || undefined,
      sessionId: targetSession.id,
      sessionName: targetSession.name,
      phoneNumber: targetSession.phone || undefined,
      isAuthenticated: Boolean(targetSession.status === 'ready' || targetSession.phone),
      session: targetSession
    };
  }

  /**
   * Sends a text message via OpenWA targeting a specific session
   */
  static async sendTextMessage(gatewayUrl: string, toPhone: string, content: string, apiKey?: string, sessionId?: string): Promise<any> {
    const workingUrl = (await this.resolveWorkingUrl(gatewayUrl)) || gatewayUrl.replace(/\/+$/, '');
    const cleanPhone = PhoneService.toCleanDigits(toPhone);
    const headers = this.getHeaders(apiKey);
    const chatId = `${cleanPhone}@c.us`;

    let targetSessionId = sessionId;

    // If no sessionId specified, find the first ready session
    if (!targetSessionId) {
      try {
        const sessionList = await axios.get(`${workingUrl}/api/sessions`, { headers, timeout: 3000 });
        if (Array.isArray(sessionList.data) && sessionList.data.length > 0) {
          const readySession = sessionList.data.find((s: any) =>
            s.status === 'ready' || s.status === 'connected' || s.status === 'authenticated' || s.phone
          );
          if (readySession) {
            targetSessionId = readySession.id;
          } else {
            targetSessionId = sessionList.data[0].id;
          }
        }
      } catch {}
    }

    // 1. Try OpenWA Session Route: POST /api/sessions/:sessionId/messages/send-text
    if (targetSessionId) {
      try {
        const res = await axios.post(`${workingUrl}/api/sessions/${targetSessionId}/messages/send-text`, {
          chatId,
          text: content
        }, { headers, timeout: 15000 });
        return res.data;
      } catch (err: any) {
        const status = err.response?.status;
        const msg = err.response?.data?.message || err.response?.data?.error;
        if (status === 400 && (msg?.includes('not active') || msg?.includes('not ready') || msg?.includes('not authenticated'))) {
          throw new Error('WhatsApp session is not paired or active. Please open "WhatsApp Numbers" and scan the live QR code.');
        }
        if (status === 409) {
          throw new Error('WhatsApp engine is initializing. Please wait a few moments and try again.');
        }
        if (status !== 404) {
          throw new Error(msg || err.message || 'Failed to send message via OpenWA session.');
        }
      }
    }

    // 2. Fallback Route A: POST /api/messages/send-text
    try {
      const res = await axios.post(`${workingUrl}/api/messages/send-text`, {
        chatId,
        text: content
      }, { headers, timeout: 15000 });
      return res.data;
    } catch {}

    // 3. Fallback Route B: POST /api/messages/sendText (classic open-wa)
    try {
      const res = await axios.post(`${workingUrl}/api/messages/sendText`, {
        to: chatId,
        content: content
      }, { headers, timeout: 15000 });
      return res.data;
    } catch {}

    // 4. Fallback Route C: POST /api/sendText
    try {
      const res = await axios.post(`${workingUrl}/api/sendText`, {
        to: chatId,
        content: content
      }, { headers, timeout: 15000 });
      return res.data;
    } catch (finalErr: any) {
      const errMsg = finalErr.response?.data?.message || finalErr.response?.data?.error || finalErr.message || 'OpenWA message endpoint unreachable.';
      throw new Error(`OpenWA message delivery failed: ${errMsg}`);
    }
  }
}
