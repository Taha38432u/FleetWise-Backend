import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    await this.resend.emails.send({
      from: `"${this.configService.getOrThrow<string>('APP_NAME')}" <${this.configService.getOrThrow<string>('EMAIL_FROM')}>`,
      to,
      subject,
      html,
    });
  }

  private loadTemplate(templateName: string): string {
    const templatePath = join(
      process.cwd(),
      'src',
      'email',
      'templates',
      `${templateName}.hbs`,
    );
    return readFileSync(templatePath, 'utf-8');
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    firstName: string,
  ): Promise<void> {
    const template = this.loadTemplate('password-reset');
    const compiledTemplate = handlebars.compile(template);

    const resetUrl = `${this.configService.getOrThrow<string>(
      'FRONTEND_URL',
    )}/reset-password?token=${resetToken}`;

    const html = compiledTemplate({
      firstName,
      resetUrl,
      appName: this.configService.getOrThrow<string>('APP_NAME'),
      supportEmail: this.configService.getOrThrow<string>('EMAIL_FROM'),
    });

    await this.sendEmail(email, 'Reset Your Password - FleetWise', html);
  }

  async sendWelcomeEmail(
    email: string,
    firstName: string,
    temporaryPassword?: string,
  ): Promise<void> {
    const template = this.loadTemplate('welcome');
    const compiledTemplate = handlebars.compile(template);

    const html = compiledTemplate({
      firstName,
      email,
      temporaryPassword,
      appName: this.configService.getOrThrow<string>('APP_NAME'),
      loginUrl: `${this.configService.getOrThrow<string>(
        'FRONTEND_URL',
      )}/login`,
      supportEmail: this.configService.getOrThrow<string>('EMAIL_FROM'),
    });

    await this.sendEmail(
      email,
      `Welcome to ${this.configService.getOrThrow<string>('APP_NAME')}!`,
      html,
    );
  }
}
