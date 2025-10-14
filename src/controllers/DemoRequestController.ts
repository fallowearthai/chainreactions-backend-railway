import { Request, Response } from 'express';
import { EmailService } from '../services/EmailService';
import { DemoRequestData, DemoRequestResponse } from '../types/DemoRequestTypes';

export class DemoRequestController {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  async handleDemoRequest(req: Request, res: Response): Promise<void> {
    try {
      console.log('Received demo request:', req.body);

      // Validate required fields
      const { firstName, lastName, email, timestamp, source } = req.body;

      if (!firstName || !lastName || !email) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: firstName, lastName, and email are required',
          labelIds: []
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          error: 'Invalid email format',
          labelIds: []
        });
        return;
      }

      const demoRequestData: DemoRequestData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        institution: req.body.institution?.trim() || '',
        jobTitle: req.body.jobTitle?.trim() || '',
        timestamp: timestamp || new Date().toISOString(),
        source: source || 'ChainReactions Website'
      };

      // Send email
      const emailResult = await this.emailService.sendDemoRequest(demoRequestData);

      if (emailResult.success) {
        const response: DemoRequestResponse = {
          success: true,
          messageId: emailResult.messageId,
          response: emailResult.response,
          labelIds: emailResult.labelIds
        };

        console.log('Demo request processed successfully:', response);
        res.status(200).json(response);
      } else {
        console.error('Failed to send demo request email:', emailResult.error);
        res.status(500).json({
          success: false,
          error: emailResult.error || 'Failed to send email',
          labelIds: []
        });
      }
    } catch (error) {
      console.error('Error in demo request handler:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        labelIds: []
      });
    }
  }

  async testEmailService(req: Request, res: Response): Promise<void> {
    try {
      const isConnected = await this.emailService.testConnection();

      res.status(200).json({
        success: isConnected,
        message: isConnected ? 'Email service is working correctly' : 'Email service connection failed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error testing email service:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test email service',
        timestamp: new Date().toISOString()
      });
    }
  }
}