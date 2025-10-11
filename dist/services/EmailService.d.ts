import { DemoRequestData, EmailResult } from '../types/DemoRequestTypes';
export declare class EmailService {
    private transporter;
    constructor();
    sendDemoRequest(data: DemoRequestData): Promise<EmailResult>;
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=EmailService.d.ts.map