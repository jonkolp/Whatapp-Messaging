import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { initDatabase } from './db';
import apiRouter from './routes';
import { errorHandler } from './middleware/error.middleware';
import { OpenWaService } from './services/openwa.service';
import { LoggerService } from './services/logger.service';

const app = express();
const server = http.createServer(app);

// Setup Socket.IO for real-time dashboard stats & status broadcasts
export const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1', apiRouter);

// Serve Frontend Static Assets (Full-stack Render Deployment)
const possibleDistPaths = [
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist')
];

for (const distPath of possibleDistPaths) {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
    break;
  }
}

// Global Error Handler Middleware
app.use(errorHandler);

// Initialize DB schema, verify open-wa connectivity & Start Server
async function bootstrap() {
  await initDatabase();

  // Check open-wa service connectivity on startup
  const openWaHealth = await OpenWaService.checkHealth(config.openWaGatewayUrl);
  if (openWaHealth.isOnline) {
    LoggerService.info(
      `[OPEN-WA HEALTH] Service is ONLINE at ${openWaHealth.gatewayUrl} (Status: ${openWaHealth.status})`,
      'Bootstrap.openWaCheck'
    );
  } else {
    LoggerService.warn(
      `[OPEN-WA HEALTH] Service is OFFLINE at ${openWaHealth.gatewayUrl}. (If using open-wa for WhatsApp Web, ensure your open-wa container is running on port 8080)`,
      'Bootstrap.openWaCheck'
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    server.listen(config.port, () => {
      console.log(`====================================================`);
      console.log(` WhatsApp Automation Backend is running!`);
      console.log(` Port: ${config.port}`);
      console.log(` Environment: ${config.nodeEnv}`);
      console.log(` Health: http://localhost:${config.port}/health`);
      console.log(` API Base: http://localhost:${config.port}/api/v1`);
      console.log(` open-wa Service: ${openWaHealth.isOnline ? '🟢 ONLINE (' + openWaHealth.status + ')' : '🟡 OFFLINE (Port 8080)'}`);
      console.log(`====================================================`);
    });
  }
}

bootstrap();

export { app, server };
