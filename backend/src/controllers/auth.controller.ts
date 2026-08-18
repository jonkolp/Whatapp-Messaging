import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { config } from '../config';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, fullName, companyName } = req.body;

      if (!email || !password || !fullName) {
        res.status(400).json({ success: false, message: 'Email, password, and full name are required.' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        return;
      }

      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
      if (existingUser) {
        res.status(409).json({ success: false, message: 'An account with this email already exists.' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const userId = uuidv4();

      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, company_name, role)
        VALUES (?, ?, ?, ?, ?, 'USER')
      `).run(userId, email.toLowerCase().trim(), passwordHash, fullName.trim(), companyName?.trim() || null);

      const token = jwt.sign({ id: userId, email: email.toLowerCase().trim(), role: 'USER' }, config.jwtSecret, {
        expiresIn: '7d' as any
      });

      res.status(201).json({
        success: true,
        message: 'Account registered successfully.',
        token,
        user: {
          id: userId,
          email: email.toLowerCase().trim(),
          fullName: fullName.trim(),
          companyName: companyName?.trim() || null
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Registration failed.' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ success: false, message: 'Email and password are required.' });
        return;
      }

      const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
      if (!user) {
        res.status(401).json({ success: false, message: 'Invalid email or password.' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Invalid email or password.' });
        return;
      }

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, {
        expiresIn: '7d' as any
      });

      res.json({
        success: true,
        message: 'Logged in successfully.',
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          companyName: user.company_name,
          role: user.role
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Login failed.' });
    }
  }

  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      const user: any = db.prepare('SELECT id, email, full_name, company_name, role, created_at FROM users WHERE id = ?').get(req.user?.id);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
