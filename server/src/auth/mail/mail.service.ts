import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from = process.env.MAIL_USER;
  private readonly clientUrl = process.env.CLIENT_URL ?? 'http://127.0.0.1:5173';

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  async sendActivationMail(email: string, activationLink: string) {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Account activation',
      html: `<div><a href="${this.clientUrl}/activate/${activationLink}" target="_blank">Activate account</a></div>`,
    });
  }

  async sendResetPasswordMail(email: string, resetLink: string) {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Password reset',
      html: `<div><a href="${this.clientUrl}/reset-password/${resetLink}" target="_blank">Set a new password</a></div>`,
    });
  }
}
