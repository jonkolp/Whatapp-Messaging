import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger.service';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  LoggerService.error(
    `Unhandled Exception on ${req.method} ${req.originalUrl}: ${message}`,
    'ExpressErrorHandler',
    err,
    {
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
      ip: req.ip,
      body: req.body
    }
  );

  res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}
