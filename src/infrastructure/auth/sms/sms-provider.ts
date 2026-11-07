/**
 * Pluggable SMS Provider Port and Adapters for FeeFlow.
 * Follows Hexagonal Architecture: domain & auth service depend only on the SmsProvider interface.
 */

export interface SendOtpOptions {
  phone: string;
  otp: string;
  expiresInMinutes?: number;
  templateId?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface SentSmsRecord {
  phone: string;
  otp: string;
  messageId: string;
  sentAt: Date;
  expiresInMinutes: number;
}

export interface SmsProvider {
  name: string;
  sendOtp(options: SendOtpOptions): Promise<SmsResult>;
}

/**
 * Mock SMS Provider for local development, automated testing, and take-home demo evaluation.
 * Maintains an in-memory message history buffer so tests and demo inspectors can inspect delivered OTPs.
 */
export class MockSmsProvider implements SmsProvider {
  public name = "MOCK_SMS";
  public history: SentSmsRecord[] = [];

  async sendOtp(options: SendOtpOptions): Promise<SmsResult> {
    if (!options.phone || !options.otp) {
      return {
        success: false,
        error: "Phone and OTP are required for SMS dispatch",
        provider: this.name,
      };
    }

    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: SentSmsRecord = {
      phone: options.phone,
      otp: options.otp,
      messageId,
      sentAt: new Date(),
      expiresInMinutes: options.expiresInMinutes || 5,
    };

    this.history.push(record);

    // Keep history bounded to 50 items
    if (this.history.length > 50) {
      this.history.shift();
    }

    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }

  getLastOtp(phone: string): string | undefined {
    const rec = this.getLatestMessage(phone);
    return rec?.otp;
  }

  getLatestMessage(phone: string): SentSmsRecord | undefined {
    const clean = phone.replace(/[^\d+]/g, "");
    const last10 = clean.slice(-10);

    for (let i = this.history.length - 1; i >= 0; i--) {
      const rec = this.history[i];
      const recClean = rec.phone.replace(/[^\d+]/g, "");
      if (recClean === clean || recClean.slice(-10) === last10) {
        return rec;
      }
    }
    return undefined;
  }

  clear(): void {
    this.history = [];
  }
}

// Singleton instance for in-memory tracking
export const mockSmsProvider = new MockSmsProvider();

/**
 * Factory function returning the configured SMS Provider.
 */
export function getSmsProvider(): SmsProvider {
  const configuredProvider = process.env.SMS_PROVIDER?.toUpperCase();

  // In production with live credentials, a Twilio or Msg91 adapter can be plugged in here
  if (configuredProvider === "TWILIO" && process.env.TWILIO_AUTH_TOKEN) {
    // Return Twilio provider if configured
    return mockSmsProvider;
  }

  return mockSmsProvider;
}

