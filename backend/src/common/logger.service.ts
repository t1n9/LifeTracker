import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private logger = new Logger();

  debug(context: string, message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${context}] ${message}`, data || '');
    }
  }

  log(context: string, message: string, data?: any) {
    this.logger.log(`[${context}] ${message}`, data ? JSON.stringify(data) : '');
  }

  error(context: string, message: string, error?: any) {
    this.logger.error(`[${context}] ${message}`, error ? JSON.stringify(error) : '');
  }

  warn(context: string, message: string, data?: any) {
    this.logger.warn(`[${context}] ${message}`, data ? JSON.stringify(data) : '');
  }
}
