import { Injectable, Logger } from '@nestjs/common';

/** Interim mailer: no provider configured, so this just logs the reset link. Replace this file once one is chosen. */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    this.logger.warn(
      `DEV MODE — no email provider configured. Password reset link for ${to}: ${resetUrl}`,
    );
  }
}
