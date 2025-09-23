import nodemailer from 'nodemailer';
import { DemoRequestData, EmailResult } from '../types/types';
import { getDemoRequestEmailTemplate } from '../templates/demoRequestTemplate';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Remove spaces from app password
    const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: process.env.GMAIL_USER || 'fallowearth.ai@gmail.com',
        pass: appPassword
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async sendDemoRequest(data: DemoRequestData): Promise<EmailResult> {
    try {
      const htmlContent = getDemoRequestEmailTemplate(data);

      const mailOptions = {
        from: process.env.GMAIL_USER || 'fallowearth.ai@gmail.com',
        to: 'fallowearth.ai@gmail.com',
        subject: 'Request from Chainreactions',
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);

      console.log('Demo request email sent successfully:', {
        messageId: result.messageId,
        response: result.response,
        envelope: result.envelope
      });

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
        labelIds: ['SENT'] // For compatibility with N8N response format
      };
    } catch (error) {
      console.error('Error sending demo request email:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        labelIds: []
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified successfully');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}