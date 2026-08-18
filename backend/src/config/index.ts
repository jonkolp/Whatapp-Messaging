import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback to local directory .env if present

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default_super_secret_jwt_key_32_characters!',
  jwtExpiresIn: '7d',
  encryptionKey: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 32-byte hex
  sqlitePath: process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../data/whatsapp.sqlite'),
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp-campaign-dispatch',
  n8nCallbackSecret: process.env.N8N_CALLBACK_SECRET || 'whatsapp_dashboard_n8n_secret_key',
  metaVerifyToken: process.env.META_VERIFY_TOKEN || 'whatsapp_meta_verify_token_123',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  openWaGatewayUrl: process.env.OPENWA_GATEWAY_URL || 'http://localhost:8080',
  uploadsDir: path.resolve(__dirname, '../../uploads')
};
