import axios from 'axios';
import { config } from '../config';

export interface N8nDispatchContact {
  campaignContactId: string;
  phone: string;
  chatId?: string;
  message: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: (string | number)[];
}

export interface N8nDispatchPayload {
  campaignId: string;
  userId: string;
  provider: 'META_CLOUD_API' | 'OPEN_WA';
  senderConfig: {
    phoneNumberId?: string;
    accessToken?: string;
    openWaUrl?: string;
    sessionId?: string;
    apiKey?: string;
  };
  callbackUrl: string;
  callbackSecret: string;
  contacts: N8nDispatchContact[];
}

export class N8nService {
  /**
   * Dispatches a batch of campaign contacts to n8n webhook engine
   */
  static async dispatchBatch(payload: N8nDispatchPayload): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await axios.post(config.n8nWebhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-Callback-Secret': config.n8nCallbackSecret
        },
        timeout: 10000 // 10s timeout for webhook ACK
      });

      return {
        success: true,
        data: response.data
      };
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to dispatch to n8n webhook';
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}
