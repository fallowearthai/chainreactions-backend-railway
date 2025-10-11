import nodemailer from 'nodemailer';
import { DemoRequestData, EmailResult } from '../types/DemoRequestTypes';
import { getDemoRequestEmailTemplate } from '../templates/demoRequestTemplate';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Remove spaces from app password
    const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
    const gmailUser = process.env.GMAIL_USER || 'fallowearth.ai@gmail.com';

    console.log('🔧 EmailService initializing with:', {
      user: gmailUser,
      hasAppPassword: !!appPassword,
      appPasswordLength: appPassword?.length
    });

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: gmailUser,
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

      console.log('📧 Attempting to send email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

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
      console.error('❌ Error sending demo request email:', {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: (error as any).code,
        command: (error as any).command,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        labelIds: []
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing Gmail SMTP connection...');
      await this.transporter.verify();
      console.log('✅ Email service connection verified successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Email service connection failed:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        errno: error.errno,
        syscall: error.syscall
      });
      return false;
    }
  }
}