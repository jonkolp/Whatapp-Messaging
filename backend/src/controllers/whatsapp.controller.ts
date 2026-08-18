import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { db } from '../db';
import { CryptoService } from '../services/crypto.service';
import { PhoneService } from '../services/phone.service';
import { LoggerService } from '../services/logger.service';
import { OpenWaService } from '../services/openwa.service';
import { config } from '../config';

export class WhatsAppController {
  static async listAccounts(req: Request, res: Response): Promise<void> {
    try {
      const accounts = db.prepare(`
        SELECT id, account_name, phone_number, provider_type, phone_number_id, waba_id, session_id,
               gateway_url, status, quality_rating, last_connected_at, created_at
        FROM whatsapp_accounts
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(req.user?.id);

      res.json({ success: true, accounts });
    } catch (err: any) {
      LoggerService.error('Failed to list WhatsApp accounts', 'WhatsAppController.listAccounts', err, { userId: req.user?.id });
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Health Check for open-wa Service
   */
  static async getOpenWaHealth(req: Request, res: Response): Promise<void> {
    try {
      const { gatewayUrl = config.openWaGatewayUrl } = req.query;
      const health = await OpenWaService.checkHealth(gatewayUrl as string);
      res.json({ success: true, health });
    } catch (err: any) {
      LoggerService.error('Failed to verify open-wa health', 'WhatsAppController.getOpenWaHealth', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * List all sessions in OpenWA container
   */
  static async getOpenWaSessions(req: Request, res: Response): Promise<void> {
    try {
      const { gatewayUrl = config.openWaGatewayUrl } = req.query;
      const sessions = await OpenWaService.listSessions(gatewayUrl as string);
      res.json({ success: true, sessions });
    } catch (err: any) {
      LoggerService.error('Failed to list OpenWA sessions', 'WhatsAppController.getOpenWaSessions', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Deletes a session in OpenWA container directly
   */
  static async deleteOpenWaSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { gatewayUrl = config.openWaGatewayUrl } = req.query;
      await OpenWaService.deleteSession(gatewayUrl as string, sessionId);
      res.json({ success: true, message: 'OpenWA session removed from engine.' });
    } catch (err: any) {
      LoggerService.error('Failed to delete OpenWA session', 'WhatsAppController.deleteOpenWaSession', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Restarts a session in OpenWA container
   */
  static async restartOpenWaSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { gatewayUrl = config.openWaGatewayUrl } = req.query;
      const data = await OpenWaService.restartSession(gatewayUrl as string, sessionId);
      res.json({ success: true, message: 'OpenWA session engine restarted.', data });
    } catch (err: any) {
      LoggerService.error('Failed to restart OpenWA session', 'WhatsAppController.restartOpenWaSession', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Fetches dynamic QR Code from OpenWA for a new or specific session
   */
  static async startOpenWaSession(req: Request, res: Response): Promise<void> {
    try {
      const { gatewayUrl = config.openWaGatewayUrl, accountName = 'WhatsApp Web', sessionId, forceNew } = req.body;
      const cleanUrl = (gatewayUrl || config.openWaGatewayUrl).trim();

      const qrResult = await OpenWaService.fetchLiveQr({
        gatewayUrl: cleanUrl,
        sessionName: accountName,
        sessionId,
        forceNew: Boolean(forceNew)
      });

      if (!qrResult.success) {
        res.status(503).json({
          success: false,
          isOnline: false,
          gatewayUrl: cleanUrl,
          message: qrResult.error || `open-wa service is offline or unreachable at ${cleanUrl}.`,
          error: qrResult.error
        });
        return;
      }

      if (qrResult.isAuthenticated) {
        res.json({
          success: true,
          isOnline: true,
          isAuthenticated: true,
          gatewayUrl: cleanUrl,
          accountName: qrResult.sessionName || accountName,
          sessionId: qrResult.sessionId,
          phoneNumber: qrResult.phoneNumber,
          session: qrResult.session,
          message: 'OpenWA session is already authenticated and ready.'
        });
        return;
      }

      res.json({
        success: true,
        isOnline: true,
        isAuthenticated: false,
        gatewayUrl: cleanUrl,
        accountName: qrResult.sessionName || accountName,
        sessionId: qrResult.sessionId,
        qrDataUrl: qrResult.qrDataUrl,
        rawQr: qrResult.rawQr,
        status: 'WAITING_FOR_QR',
        instruction: 'Open WhatsApp on your phone > Linked Devices > Link a Device, and scan this live QR code.'
      });
    } catch (err: any) {
      LoggerService.error('Failed in startOpenWaSession', 'WhatsAppController.startOpenWaSession', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Confirms & saves the open-wa QR-paired session
   */
  static async confirmOpenWaSession(req: Request, res: Response): Promise<void> {
    try {
      const { accountName, phoneNumber, gatewayUrl = config.openWaGatewayUrl, sessionId } = req.body;

      if (!phoneNumber || !accountName) {
        res.status(400).json({ success: false, message: 'Account name and phone number are required.' });
        return;
      }

      const formatted = PhoneService.validateAndFormat(phoneNumber);
      if (!formatted.isValid) {
        res.status(400).json({ success: false, message: `Invalid phone number: ${formatted.error}` });
        return;
      }

      const targetSessionId = sessionId || `wa_session_${Date.now()}`;
      const accountId = uuidv4();

      db.prepare(`
        INSERT INTO whatsapp_accounts (
          id, user_id, account_name, phone_number, provider_type,
          session_id, gateway_url, status, quality_rating, last_connected_at
        ) VALUES (?, ?, ?, ?, 'OPEN_WA', ?, ?, 'CONNECTED', 'GREEN', datetime('now'))
      `).run(
        accountId,
        req.user?.id,
        accountName.trim(),
        formatted.e164,
        targetSessionId,
        (gatewayUrl || config.openWaGatewayUrl).trim()
      );

      LoggerService.info(`open-wa QR session registered: ${formatted.e164} (${accountName}) [Session ID: ${targetSessionId}]`, 'WhatsAppController.confirmOpenWaSession');

      res.status(201).json({
        success: true,
        message: 'WhatsApp Web QR connection successfully verified and registered.',
        account: {
          id: accountId,
          accountName: accountName.trim(),
          phoneNumber: formatted.e164,
          providerType: 'OPEN_WA',
          sessionId: targetSessionId,
          status: 'CONNECTED'
        }
      });
    } catch (err: any) {
      LoggerService.error('Failed to confirm open-wa session', 'WhatsAppController.confirmOpenWaSession', err);
      if (err.message?.includes('UNIQUE constraint failed')) {
        res.status(409).json({ success: false, message: 'This phone number is already connected.' });
        return;
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async addAccount(req: Request, res: Response): Promise<void> {
    try {
      const {
        accountName,
        phoneNumber,
        providerType,
        phoneNumberId,
        wabaId,
        accessToken,
        gatewayUrl,
        apiKey
      } = req.body;

      if (!accountName || !phoneNumber || !providerType) {
        res.status(400).json({ success: false, message: 'Missing required account details.' });
        return;
      }

      const formatted = PhoneService.validateAndFormat(phoneNumber);
      if (!formatted.isValid) {
        res.status(400).json({ success: false, message: `Invalid phone format: ${formatted.error}` });
        return;
      }

      let encryptedAccessToken = null;
      let encryptedApiKey = null;

      if (providerType === 'META_CLOUD_API') {
        if (!phoneNumberId || !wabaId || !accessToken) {
          res.status(400).json({ success: false, message: 'Meta Cloud API requires phoneNumberId, wabaId, and accessToken.' });
          return;
        }
        encryptedAccessToken = CryptoService.encrypt(accessToken);
      } else if (providerType === 'OPEN_WA') {
        if (apiKey) {
          encryptedApiKey = CryptoService.encrypt(apiKey);
        }
      }

      const accountId = uuidv4();
      const qualityRating = 'GREEN';

      db.prepare(`
        INSERT INTO whatsapp_accounts (
          id, user_id, account_name, phone_number, provider_type,
          phone_number_id, waba_id, encrypted_access_token,
          gateway_url, encrypted_api_key, status, quality_rating, last_connected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONNECTED', ?, datetime('now'))
      `).run(
        accountId,
        req.user?.id,
        accountName.trim(),
        formatted.e164,
        providerType,
        phoneNumberId || null,
        wabaId || null,
        encryptedAccessToken,
        gatewayUrl ? gatewayUrl.trim() : null,
        encryptedApiKey,
        qualityRating
      );

      res.status(201).json({
        success: true,
        message: 'WhatsApp account successfully connected.',
        account: {
          id: accountId,
          accountName: accountName.trim(),
          phoneNumber: formatted.e164,
          providerType,
          status: 'CONNECTED',
          qualityRating
        }
      });
    } catch (err: any) {
      LoggerService.error('Failed to add WhatsApp account', 'WhatsAppController.addAccount', err);
      if (err.message?.includes('UNIQUE constraint failed')) {
        res.status(409).json({ success: false, message: 'This phone number is already connected to your account.' });
        return;
      }
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async testMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { recipientPhone, message } = req.body;

      if (!recipientPhone || !message) {
        res.status(400).json({ success: false, message: 'Recipient phone number and message are required.' });
        return;
      }

      const account: any = db.prepare('SELECT * FROM whatsapp_accounts WHERE id = ? AND user_id = ?').get(id, req.user?.id);
      if (!account) {
        res.status(404).json({ success: false, message: 'WhatsApp account not found.' });
        return;
      }

      const formatted = PhoneService.validateAndFormat(recipientPhone);
      if (!formatted.isValid) {
        res.status(400).json({ success: false, message: 'Invalid recipient phone number.' });
        return;
      }

      if (account.provider_type === 'META_CLOUD_API') {
        const decryptedToken = CryptoService.decrypt(account.encrypted_access_token);
        const url = `https://graph.facebook.com/v23.0/${account.phone_number_id}/messages`;
        
        const response = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formatted.e164.replace(/\+/g, ''),
            type: 'text',
            text: { preview_url: false, body: message }
          },
          {
            headers: {
              Authorization: `Bearer ${decryptedToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        res.json({ success: true, message: 'Test message sent successfully.', data: response.data });
      } else {
        // open-wa multi-session targeting
        let apiKey = undefined;
        if (account.encrypted_api_key) {
          apiKey = CryptoService.decrypt(account.encrypted_api_key);
        }
        const gateway = account.gateway_url || config.openWaGatewayUrl;
        const responseData = await OpenWaService.sendTextMessage(
          gateway,
          formatted.cleanDigits,
          message,
          apiKey,
          account.session_id
        );

        res.json({ success: true, message: 'Test message sent via open-wa.', data: responseData });
      }
    } catch (err: any) {
      LoggerService.error(`Failed to send test message via ${req.params.id}`, 'WhatsAppController.testMessage', err);
      const errorMsg = err.response?.data?.error?.message || err.message || 'Failed to send test message.';
      res.status(500).json({ success: false, message: errorMsg, details: err.response?.data });
    }
  }

  static async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const account: any = db.prepare('SELECT * FROM whatsapp_accounts WHERE id = ? AND user_id = ?').get(id, req.user?.id);
      
      if (!account) {
        res.status(404).json({ success: false, message: 'Account not found.' });
        return;
      }

      // If OpenWA session, also delete the session from the OpenWA container
      if (account.provider_type === 'OPEN_WA' && account.session_id) {
        try {
          const gateway = account.gateway_url || config.openWaGatewayUrl;
          await OpenWaService.deleteSession(gateway, account.session_id);
        } catch (e: any) {
          LoggerService.warn(`Could not delete OpenWA session ${account.session_id}: ${e.message}`, 'WhatsAppController.deleteAccount');
        }
      }

      db.prepare('DELETE FROM whatsapp_accounts WHERE id = ? AND user_id = ?').run(id, req.user?.id);
      res.json({ success: true, message: 'WhatsApp account removed and session disconnected.' });
    } catch (err: any) {
      LoggerService.error('Failed to delete WhatsApp account', 'WhatsAppController.deleteAccount', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
