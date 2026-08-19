import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { ExcelService } from '../services/excel.service';
import { PhoneService } from '../services/phone.service';
import { N8nService, N8nDispatchContact } from '../services/n8n.service';
import { CryptoService } from '../services/crypto.service';
import { SafetyService } from '../services/safety.service';
import { LoggerService } from '../services/logger.service';
import { OpenWaService } from '../services/openwa.service';
import axios from 'axios';
import { config } from '../config';

export class CampaignController {
  static async listCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const campaigns = db.prepare(`
        SELECT c.*, w.account_name, w.phone_number as sender_phone, w.provider_type
        FROM campaigns c
        JOIN whatsapp_accounts w ON c.whatsapp_account_id = w.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `).all(req.user?.id);

      res.json({ success: true, campaigns });
    } catch (err: any) {
      LoggerService.error('Failed to list campaigns', 'CampaignController.listCampaigns', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign: any = db.prepare(`
        SELECT c.*, w.account_name, w.phone_number as sender_phone, w.provider_type
        FROM campaigns c
        JOIN whatsapp_accounts w ON c.whatsapp_account_id = w.id
        WHERE c.id = ? AND c.user_id = ?
      `).get(id, req.user?.id);

      if (!campaign) {
        res.status(404).json({ success: false, message: 'Campaign not found.' });
        return;
      }

      const contacts = db.prepare(`
        SELECT * FROM campaign_contacts
        WHERE campaign_id = ?
        ORDER BY rowid ASC
        LIMIT 100
      `).all(id);

      res.json({ success: true, campaign, contacts });
    } catch (err: any) {
      LoggerService.error(`Failed to get campaign ${req.params.id}`, 'CampaignController.getCampaign', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async createCampaign(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        whatsappAccountId,
        uploadedFileId,
        messageType,
        templateName,
        templateLanguage,
        messageBody,
        columnMapping,
        respectQuietHours,
        sendDelaySeconds
      } = req.body;

      if (!name || !whatsappAccountId || !uploadedFileId || !columnMapping) {
        res.status(400).json({ success: false, message: 'Name, WhatsApp Account, File, and Column Mapping are required.' });
        return;
      }

      const account: any = db.prepare('SELECT * FROM whatsapp_accounts WHERE id = ? AND user_id = ?').get(whatsappAccountId, req.user?.id);
      if (!account) {
        res.status(404).json({ success: false, message: 'Selected WhatsApp account not found.' });
        return;
      }

      const fileRecord: any = db.prepare('SELECT * FROM uploaded_files WHERE id = ? AND user_id = ?').get(uploadedFileId, req.user?.id);
      if (!fileRecord) {
        res.status(404).json({ success: false, message: 'Selected file not found.' });
        return;
      }

      const parsed = await ExcelService.parseAndValidate(fileRecord.storage_path, columnMapping);
      if (parsed.validRows.length === 0) {
        res.status(400).json({ success: false, message: 'No valid phone numbers found in the file with the given column mapping.' });
        return;
      }

      const campaignId = uuidv4();

      const insertCampaign = db.transaction(() => {
        db.prepare(`
          INSERT INTO campaigns (
            id, user_id, whatsapp_account_id, uploaded_file_id, name,
            status, message_type, template_name, template_language, message_body,
            column_mapping, send_delay_seconds, respect_quiet_hours, total_contacts
          ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          campaignId,
          req.user?.id,
          whatsappAccountId,
          uploadedFileId,
          name.trim(),
          messageType || 'TEXT',
          templateName || null,
          templateLanguage || 'ar',
          messageBody || '',
          JSON.stringify(columnMapping),
          sendDelaySeconds || 10,
          respectQuietHours !== false ? 1 : 0,
          parsed.validRows.length
        );

        const insertContactStmt = db.prepare(`
          INSERT INTO campaign_contacts (
            id, campaign_id, phone_e164, custom_variables, status
          ) VALUES (?, ?, ?, ?, 'PENDING')
        `);

        for (const row of parsed.validRows) {
          const contactId = uuidv4();
          insertContactStmt.run(
            contactId,
            campaignId,
            row.formattedPhone,
            JSON.stringify(row.customData)
          );
        }
      });

      insertCampaign();

      LoggerService.info(`Campaign created: "${name}" (${parsed.validRows.length} contacts)`, 'CampaignController.createCampaign');

      res.status(201).json({
        success: true,
        message: 'Campaign created successfully.',
        campaignId,
        validContactsCount: parsed.validRows.length,
        invalidContactsCount: parsed.invalidRows.length
      });
    } catch (err: any) {
      LoggerService.error('Failed to create campaign', 'CampaignController.createCampaign', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async startCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const campaign: any = db.prepare(`
        SELECT c.*, w.account_name, w.phone_number as sender_phone, w.phone_number_id, 
               w.encrypted_access_token, w.gateway_url, w.provider_type, w.session_id, w.encrypted_api_key
        FROM campaigns c
        JOIN whatsapp_accounts w ON c.whatsapp_account_id = w.id
        WHERE c.id = ? AND c.user_id = ?
      `).get(id, req.user?.id);

      if (!campaign) {
        res.status(404).json({ success: false, message: 'Campaign not found.' });
        return;
      }

      const contacts: any[] = db.prepare(`
        SELECT * FROM campaign_contacts
        WHERE campaign_id = ? AND status = 'PENDING'
      `).all(id);

      if (contacts.length === 0) {
        res.status(400).json({ success: false, message: 'No pending contacts found to send.' });
        return;
      }

      if (campaign.respect_quiet_hours && SafetyService.isQuietHours()) {
        LoggerService.warn(`Campaign ${id} dispatch blocked: currently within quiet hours.`, 'CampaignController.startCampaign');
        res.status(400).json({
          success: false,
          message: 'Currently within Quiet Hours (11:00 PM - 08:00 AM). Delivery prevented to protect number health.'
        });
        return;
      }

      let accessToken = undefined;
      if (campaign.provider_type === 'META_CLOUD_API' && campaign.encrypted_access_token) {
        accessToken = CryptoService.decrypt(campaign.encrypted_access_token);
      }

      const n8nContacts: N8nDispatchContact[] = contacts.map(c => {
        const customVars = JSON.parse(c.custom_variables || '{}');
        
        let resolvedMessage = campaign.message_body || '';
        for (const [key, val] of Object.entries(customVars)) {
          resolvedMessage = resolvedMessage.replace(new RegExp(`{{${key}}}`, 'g'), String(val));
        }

        return {
          campaignContactId: c.id,
          phone: PhoneService.toCleanDigits(c.phone_e164),
          chatId: PhoneService.toChatId(c.phone_e164),
          message: resolvedMessage,
          templateName: campaign.template_name,
          templateLanguage: campaign.template_language,
          templateParams: Object.values(customVars) as (string | number)[]
        };
      });

      db.prepare("UPDATE campaigns SET status = 'RUNNING', started_at = datetime('now') WHERE id = ?").run(id);

      let openWaApiKey = undefined;
      if (campaign.encrypted_api_key) {
        openWaApiKey = CryptoService.decrypt(campaign.encrypted_api_key);
      }

      const dispatchPayload = {
        campaignId: campaign.id,
        userId: req.user?.id || '',
        provider: campaign.provider_type,
        senderConfig: {
          phoneNumberId: campaign.phone_number_id,
          accessToken: accessToken,
          openWaUrl: campaign.gateway_url,
          sessionId: campaign.session_id,
          apiKey: openWaApiKey
        },
        callbackUrl: `http://localhost:${config.port}/api/v1/webhooks/n8n/status`,
        callbackSecret: config.n8nCallbackSecret,
        contacts: n8nContacts
      };

      const dispatchResult = await N8nService.dispatchBatch(dispatchPayload);

      if (!dispatchResult.success) {
        LoggerService.warn(`n8n webhook dispatch not available (${dispatchResult.error}). Dispatching via native background queue...`, 'CampaignController.startCampaign');
        
        CampaignController.runDirectCampaignDispatcher(campaign, n8nContacts);

        res.json({
          success: true,
          message: 'Campaign started via native WhatsApp dispatcher.',
          totalQueued: contacts.length
        });
        return;
      }

      LoggerService.info(`Campaign ${id} successfully dispatched ${contacts.length} contacts to n8n`, 'CampaignController.startCampaign');

      res.json({
        success: true,
        message: 'Campaign dispatched to n8n automation engine.',
        totalQueued: contacts.length
      });
    } catch (err: any) {
      LoggerService.error(`Failed to start campaign ${req.params.id}`, 'CampaignController.startCampaign', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  private static async runDirectCampaignDispatcher(campaign: any, contacts: N8nDispatchContact[]) {
    // Run in background
    setTimeout(async () => {
      let sentCount = 0;
      let failedCount = 0;

      for (const item of contacts) {
        try {
          // Check campaign status before sending each item
          const current: any = db.prepare('SELECT status FROM campaigns WHERE id = ?').get(campaign.id);
          if (current?.status === 'PAUSED' || current?.status === 'CANCELLED') {
            LoggerService.info(`Campaign ${campaign.id} dispatch stopped (${current.status})`, 'CampaignController.runDirectCampaignDispatcher');
            return;
          }

          const gateway = campaign.gateway_url || 'http://localhost:2785';
          let apiKey = undefined;
          if (campaign.encrypted_api_key) {
            apiKey = CryptoService.decrypt(campaign.encrypted_api_key);
          }

          if (campaign.provider_type === 'META_CLOUD_API') {
            let token = undefined;
            if (campaign.encrypted_access_token) {
              token = CryptoService.decrypt(campaign.encrypted_access_token);
            }
            await axios.post(
              `https://graph.facebook.com/v18.0/${campaign.phone_number_id}/messages`,
              {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: item.phone,
                type: 'text',
                text: { preview_url: false, body: item.message }
              },
              { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
          } else {
            await OpenWaService.sendTextMessage(gateway, item.phone, item.message, apiKey, campaign.session_id);
          }

          sentCount++;
          db.prepare(`
            UPDATE campaign_contacts 
            SET status = 'SENT', sent_at = datetime('now') 
            WHERE id = ?
          `).run(item.campaignContactId);

          db.prepare(`
            UPDATE campaigns 
            SET sent_count = sent_count + 1 
            WHERE id = ?
          `).run(campaign.id);

          LoggerService.info(`[Campaign ${campaign.name}] Sent message to ${item.phone} (${sentCount}/${contacts.length})`, 'CampaignController.runDirectCampaignDispatcher');

          // Pacing delay + anti-ban jitter
          const baseDelay = (campaign.send_delay_seconds || 5) * 1000;
          const jitter = Math.floor(Math.random() * 3000);
          await new Promise(r => setTimeout(r, baseDelay + jitter));
        } catch (err: any) {
          failedCount++;
          const errorMsg = err.message || 'Failed to send';
          db.prepare(`
            UPDATE campaign_contacts 
            SET status = 'FAILED', error_message = ? 
            WHERE id = ?
          `).run(errorMsg, item.campaignContactId);

          db.prepare(`
            UPDATE campaigns 
            SET failed_count = failed_count + 1 
            WHERE id = ?
          `).run(campaign.id);

          LoggerService.error(`[Campaign ${campaign.name}] Failed to send message to ${item.phone}: ${errorMsg}`, 'CampaignController.runDirectCampaignDispatcher', err);
        }
      }

      db.prepare(`
        UPDATE campaigns 
        SET status = 'COMPLETED', completed_at = datetime('now') 
        WHERE id = ?
      `).run(campaign.id);

      LoggerService.info(`Campaign ${campaign.name} finished. Sent: ${sentCount}, Failed: ${failedCount}`, 'CampaignController.runDirectCampaignDispatcher');
    }, 100);
  }

  static async pauseCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      db.prepare("UPDATE campaigns SET status = 'PAUSED' WHERE id = ? AND user_id = ?").run(id, req.user?.id);
      res.json({ success: true, message: 'Campaign paused.' });
    } catch (err: any) {
      LoggerService.error(`Failed to pause campaign ${req.params.id}`, 'CampaignController.pauseCampaign', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async cancelCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      db.prepare("UPDATE campaigns SET status = 'CANCELLED' WHERE id = ? AND user_id = ?").run(id, req.user?.id);
      res.json({ success: true, message: 'Campaign cancelled.' });
    } catch (err: any) {
      LoggerService.error(`Failed to cancel campaign ${req.params.id}`, 'CampaignController.cancelCampaign', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async retryFailed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      db.prepare("UPDATE campaign_contacts SET status = 'PENDING', error_message = NULL WHERE campaign_id = ? AND status = 'FAILED'").run(id);
      db.prepare("UPDATE campaigns SET status = 'DRAFT' WHERE id = ? AND user_id = ?").run(id, req.user?.id);
      res.json({ success: true, message: 'Failed contacts reset to PENDING. Campaign ready to run again.' });
    } catch (err: any) {
      LoggerService.error(`Failed to retry campaign ${req.params.id}`, 'CampaignController.retryFailed', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const messages = db.prepare(`
        SELECT m.*, cc.phone_e164
        FROM messages m
        JOIN campaign_contacts cc ON m.campaign_contact_id = cc.id
        WHERE m.campaign_id = ?
        ORDER BY m.created_at DESC
        LIMIT 200
      `).all(id);

      res.json({ success: true, messages });
    } catch (err: any) {
      LoggerService.error(`Failed to get messages for campaign ${req.params.id}`, 'CampaignController.getMessages', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(id, req.user?.id);
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Campaign not found.' });
        return;
      }

      const deleteTx = db.transaction(() => {
        db.prepare('DELETE FROM messages WHERE campaign_id = ?').run(id);
        db.prepare('DELETE FROM campaign_contacts WHERE campaign_id = ?').run(id);
        db.prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?').run(id, req.user?.id);
      });
      deleteTx();

      LoggerService.info(`Campaign ${id} deleted by user ${req.user?.id}`, 'CampaignController.deleteCampaign');
      res.json({ success: true, message: 'Campaign and associated messages deleted successfully.' });
    } catch (err: any) {
      LoggerService.error(`Failed to delete campaign ${req.params.id}`, 'CampaignController.deleteCampaign', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
