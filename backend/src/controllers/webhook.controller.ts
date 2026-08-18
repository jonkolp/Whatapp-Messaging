import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { SafetyService } from '../services/safety.service';
import { LoggerService } from '../services/logger.service';
import { config } from '../config';

export class WebhookController {
  static handleMetaHandshake(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.metaVerifyToken) {
      LoggerService.info('Meta Webhook handshake verified successfully', 'WebhookController.handleMetaHandshake');
      res.status(200).send(challenge);
    } else {
      LoggerService.warn(`Meta Webhook handshake rejected: token mismatch (received: ${token})`, 'WebhookController.handleMetaHandshake');
      res.status(403).send('Forbidden: Token mismatch');
    }
  }

  static async handleMetaEvents(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;

      if (body.object === 'whatsapp_business_account' && body.entry) {
        for (const entry of body.entry) {
          for (const change of entry.changes || []) {
            const value = change.value;

            // 1. Process Delivery Receipts (sent, delivered, read, failed)
            if (value.statuses) {
              for (const statusObj of value.statuses) {
                const wamid = statusObj.id;
                const statusStr = statusObj.status?.toUpperCase();

                if (statusStr) {
                  db.prepare(`
                    UPDATE messages
                    SET status = ?, updated_at = datetime('now')
                    WHERE provider_message_id = ?
                  `).run(statusStr, wamid);

                  if (statusStr === 'DELIVERED') {
                    db.prepare(`
                      UPDATE campaigns SET delivered_count = delivered_count + 1
                      WHERE id = (SELECT campaign_id FROM messages WHERE provider_message_id = ?)
                    `).run(wamid);
                  } else if (statusStr === 'READ') {
                    db.prepare(`
                      UPDATE campaigns SET read_count = read_count + 1
                      WHERE id = (SELECT campaign_id FROM messages WHERE provider_message_id = ?)
                    `).run(wamid);
                  }
                }
              }
            }

            // 2. Process Inbound Messages & Detect Opt-Out Keywords
            if (value.messages) {
              for (const msg of value.messages) {
                const senderPhone = `+${msg.from}`;
                const textBody = msg.text?.body || '';

                if (SafetyService.isOptOutMessage(textBody)) {
                  LoggerService.info(`Customer opted out: ${senderPhone} (Keyword: "${textBody}")`, 'WebhookController.handleMetaEvents');
                  db.prepare(`
                    UPDATE contacts
                    SET is_opted_out = 1, opted_out_at = datetime('now')
                    WHERE phone_e164 = ?
                  `).run(senderPhone);
                }
              }
            }
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (err: any) {
      LoggerService.error('Error processing Meta Webhook event', 'WebhookController.handleMetaEvents', err, req.body);
      res.status(200).json({ success: false, error: err.message });
    }
  }

  static async handleN8nStatus(req: Request, res: Response): Promise<void> {
    try {
      const {
        campaignId,
        campaignContactId,
        phone,
        status,
        providerMessageId,
        error
      } = req.body;

      if (!campaignId || !campaignContactId || !status) {
        LoggerService.warn('Invalid n8n status callback payload', 'WebhookController.handleN8nStatus', req.body);
        res.status(400).json({ success: false, message: 'Missing required callback fields.' });
        return;
      }

      const campaign: any = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      if (!campaign) {
        LoggerService.warn(`n8n callback received for non-existent campaign: ${campaignId}`, 'WebhookController.handleN8nStatus');
        res.status(404).json({ success: false, message: 'Campaign not found.' });
        return;
      }

      if (status === 'FAILED') {
        LoggerService.error(`Message failed to deliver to ${phone}: ${error}`, 'WebhookController.handleN8nStatus', { campaignId, campaignContactId, error });
      }

      db.prepare(`
        UPDATE campaign_contacts
        SET status = ?, error_message = ?, sent_at = CASE WHEN ? = 'SENT' THEN datetime('now') ELSE sent_at END
        WHERE id = ?
      `).run(status, error || null, status, campaignContactId);

      const messageId = uuidv4();
      db.prepare(`
        INSERT INTO messages (
          id, campaign_contact_id, campaign_id, whatsapp_account_id,
          provider_message_id, direction, recipient_phone, message_content, status, error_details
        ) VALUES (?, ?, ?, ?, ?, 'OUTBOUND', ?, ?, ?, ?)
      `).run(
        messageId,
        campaignContactId,
        campaignId,
        campaign.whatsapp_account_id,
        providerMessageId || null,
        phone,
        campaign.message_body || '',
        status,
        error ? JSON.stringify({ error }) : null
      );

      if (status === 'SENT') {
        db.prepare('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?').run(campaignId);
      } else if (status === 'FAILED') {
        db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?').run(campaignId);
      }

      const remaining: any = db.prepare("SELECT COUNT(*) as count FROM campaign_contacts WHERE campaign_id = ? AND status = 'PENDING'").get(campaignId);
      if (remaining.count === 0) {
        db.prepare("UPDATE campaigns SET status = 'COMPLETED', completed_at = datetime('now') WHERE id = ?").run(campaignId);
        LoggerService.info(`Campaign completed: ${campaignId}`, 'WebhookController.handleN8nStatus');
      }

      res.json({ success: true, message: 'Status updated.' });
    } catch (err: any) {
      LoggerService.error('Error handling n8n status callback', 'WebhookController.handleN8nStatus', err, req.body);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
