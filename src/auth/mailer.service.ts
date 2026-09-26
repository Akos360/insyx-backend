import { Injectable, Logger } from '@nestjs/common';

/**
 * Interim mailer — no email provider is configured yet, so this just logs
 * the reset link instead of sending it. This is the one file to replace
 * once a real provider (Resend/SendGrid/SMTP/etc.) is chosen; nothing else
 * in AuthService needs to change.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    this.logger.warn(
      `DEV MODE — no email provider configured. Password reset link for ${to}: ${resetUrl}`,
    );
  }
}
