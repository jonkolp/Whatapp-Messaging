import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthController } from '../controllers/auth.controller';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { FileController } from '../controllers/file.controller';
import { CampaignController } from '../controllers/campaign.controller';
import { WebhookController } from '../controllers/webhook.controller';
import { SystemController } from '../controllers/system.controller';

const router = Router();

// Multer configuration for Excel uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `file-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls, .csv) are allowed.'));
    }
  }
});

// 1. Auth Routes
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.get('/auth/me', authMiddleware, AuthController.getMe);

// 2. WhatsApp Accounts Routes
router.get('/whatsapp/accounts', authMiddleware, WhatsAppController.listAccounts);
router.post('/whatsapp/accounts', authMiddleware, WhatsAppController.addAccount);
router.get('/whatsapp/openwa/health', authMiddleware, WhatsAppController.getOpenWaHealth);
router.get('/whatsapp/openwa/sessions', authMiddleware, WhatsAppController.getOpenWaSessions);
router.delete('/whatsapp/openwa/sessions/:sessionId', authMiddleware, WhatsAppController.deleteOpenWaSession);
router.post('/whatsapp/openwa/sessions/:sessionId/restart', authMiddleware, WhatsAppController.restartOpenWaSession);
router.post('/whatsapp/openwa/start-session', authMiddleware, WhatsAppController.startOpenWaSession);
router.post('/whatsapp/openwa/confirm-session', authMiddleware, WhatsAppController.confirmOpenWaSession);
router.post('/whatsapp/accounts/:id/test', authMiddleware, WhatsAppController.testMessage);
router.delete('/whatsapp/accounts/:id', authMiddleware, WhatsAppController.deleteAccount);

// 3. File & Contact Routes
router.get('/files', authMiddleware, FileController.listFiles);
router.post('/files/upload', authMiddleware, upload.single('file'), FileController.uploadFile);
router.post('/files/:id/validate-mapping', authMiddleware, FileController.previewMapping);
router.delete('/files/:id', authMiddleware, FileController.deleteFile);

// 4. Campaign Routes
router.get('/campaigns', authMiddleware, CampaignController.listCampaigns);
router.post('/campaigns', authMiddleware, CampaignController.createCampaign);
router.get('/campaigns/:id', authMiddleware, CampaignController.getCampaign);
router.post('/campaigns/:id/start', authMiddleware, CampaignController.startCampaign);
router.post('/campaigns/:id/pause', authMiddleware, CampaignController.pauseCampaign);
router.post('/campaigns/:id/cancel', authMiddleware, CampaignController.cancelCampaign);
router.post('/campaigns/:id/retry-failed', authMiddleware, CampaignController.retryFailed);
router.delete('/campaigns/:id', authMiddleware, CampaignController.deleteCampaign);
router.get('/campaigns/:id/messages', authMiddleware, CampaignController.getMessages);

// 5. Webhook Routes
router.get('/webhooks/meta-whatsapp', WebhookController.handleMetaHandshake);
router.post('/webhooks/meta-whatsapp', WebhookController.handleMetaEvents);
router.post('/webhooks/n8n/status', WebhookController.handleN8nStatus);

// 6. System & Error Logs Routes
router.get('/system/logs', authMiddleware, SystemController.getLogs);
router.delete('/system/logs', authMiddleware, SystemController.clearLogs);

export default router;
