import request from 'supertest';
import { app } from '../src/server';
import { CryptoService } from '../src/services/crypto.service';
import { PhoneService } from '../src/services/phone.service';
import { SafetyService } from '../src/services/safety.service';
import { LoggerService } from '../src/services/logger.service';
import { OpenWaService } from '../src/services/openwa.service';

describe('1. Security & Crypto Service', () => {
  it('should encrypt and decrypt sensitive WhatsApp tokens correctly', () => {
    const rawToken = 'EAABwzLix...secret_meta_token_123456';
    const encrypted = CryptoService.encrypt(rawToken);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(rawToken);
    expect(encrypted.split(':').length).toBe(3);

    const decrypted = CryptoService.decrypt(encrypted);
    expect(decrypted).toEqual(rawToken);
  });
});

describe('2. Phone Parsing & E.164 Normalization', () => {
  it('should normalize Saudi phone numbers into E.164 and clean digits', () => {
    const res1 = PhoneService.validateAndFormat('0501234567', 'SA');
    expect(res1.isValid).toBe(true);
    expect(res1.e164).toBe('+966501234567');
    expect(res1.cleanDigits).toBe('966501234567');
    expect(res1.chatId).toBe('966501234567@c.us');

    const res2 = PhoneService.validateAndFormat('966501234567');
    expect(res2.isValid).toBe(true);
    expect(res2.e164).toBe('+966501234567');

    const res3 = PhoneService.validateAndFormat('+966 50 123 4567');
    expect(res3.isValid).toBe(true);
    expect(res3.e164).toBe('+966501234567');

    const res4 = PhoneService.validateAndFormat('00966501234567');
    expect(res4.isValid).toBe(true);
    expect(res4.e164).toBe('+966501234567');
  });

  it('should normalize numbers from any international country code (US, UK, Egypt, UAE, etc.)', () => {
    // US / Canada (+1)
    const usRes = PhoneService.validateAndFormat('+1 202 555 0123');
    expect(usRes.isValid).toBe(true);
    expect(usRes.e164).toBe('+12025550123');
    expect(usRes.cleanDigits).toBe('12025550123');
    expect(usRes.chatId).toBe('12025550123@c.us');

    // UK (+44)
    const ukRes = PhoneService.validateAndFormat('447911123456');
    expect(ukRes.isValid).toBe(true);
    expect(ukRes.e164).toBe('+447911123456');
    expect(ukRes.cleanDigits).toBe('447911123456');

    // Egypt (+20)
    const egRes = PhoneService.validateAndFormat('+201001234567');
    expect(egRes.isValid).toBe(true);
    expect(egRes.e164).toBe('+201001234567');

    // UAE (+971)
    const uaeRes = PhoneService.validateAndFormat('00971501234567');
    expect(uaeRes.isValid).toBe(true);
    expect(uaeRes.e164).toBe('+971501234567');

    // Excel single-quoted numbers
    const excelRes = PhoneService.validateAndFormat("'+966501234567");
    expect(excelRes.isValid).toBe(true);
    expect(excelRes.e164).toBe('+966501234567');
  });

  it('should reject invalid or excessively short phone numbers', () => {
    const res = PhoneService.validateAndFormat('12345');
    expect(res.isValid).toBe(false);
  });
});

describe('3. Safety & Opt-Out Watcher', () => {
  it('should detect English and Arabic opt-out keywords', () => {
    expect(SafetyService.isOptOutMessage('stop')).toBe(true);
    expect(SafetyService.isOptOutMessage('STOP')).toBe(true);
    expect(SafetyService.isOptOutMessage('إيقاف')).toBe(true);
    expect(SafetyService.isOptOutMessage('الغاء')).toBe(true);
    expect(SafetyService.isOptOutMessage('Hello, how much is this?')).toBe(false);
  });
});

describe('4. Logger & open-wa Service Checks', () => {
  it('should record and retrieve backend error logs', () => {
    LoggerService.error('Test system error message', 'TestContext', new Error('Sample crash'));
    const logs = LoggerService.getRecentLogs('ERROR');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].message).toContain('Test system error message');
    expect(logs[0].context).toBe('TestContext');
  });

  it('should handle open-wa health checks gracefully', async () => {
    const health = await OpenWaService.checkHealth('http://localhost:8080');
    expect(health).toBeDefined();
    expect(typeof health.isOnline).toBe('boolean');
    expect(health.gatewayUrl).toBeDefined();
  });
});

describe('5. Auth API & Tenant Isolation', () => {
  const testEmail = `testuser_${Date.now()}@example.com`;
  let authToken = '';

  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        fullName: 'Test Marketer',
        companyName: 'Acme Media'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  it('should login with the created user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('should fetch user profile with Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(testEmail);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/campaigns');
    expect(res.status).toBe(401);
  });
});

describe('6. Database Transaction & Campaign Creation', () => {
  it('should execute atomic multi-insert transactions without rollback or commit errors', () => {
    const { db } = require('../src/db');
    const { v4: uuidv4 } = require('uuid');

    const testCampaignId = uuidv4();
    const runTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO campaigns (id, user_id, whatsapp_account_id, name, total_contacts)
        VALUES (?, 'system', 'dummy-account', 'Transaction Integrity Test', 5)
      `).run(testCampaignId);

      const insertStmt = db.prepare(`
        INSERT INTO campaign_contacts (id, campaign_id, phone_e164)
        VALUES (?, ?, ?)
      `);

      for (let i = 0; i < 5; i++) {
        insertStmt.run(uuidv4(), testCampaignId, `+96650000000${i}`);
      }
    });

    expect(() => runTx()).not.toThrow();

    const saved: any = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(testCampaignId);
    expect(saved).toBeDefined();
    expect(saved.name).toBe('Transaction Integrity Test');

    const contacts: any[] = db.prepare('SELECT * FROM campaign_contacts WHERE campaign_id = ?').all(testCampaignId);
    expect(contacts.length).toBe(5);
  });
});

