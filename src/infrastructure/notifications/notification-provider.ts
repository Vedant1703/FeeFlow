/**
 * Fee Reminder Notification Provider Interface and Mock Implementation.
 * Supports sending transactional reminders over WHATSAPP and SMS.
 */

export interface FeeReminderPayload {
  phone: string;
  subject: string;
  body: string;
  channel: "WHATSAPP" | "SMS";
  studentName?: string;
  studentCode?: string;
  amountPaise?: bigint;
  idempotencyKey?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  sentAt: Date;
}

export interface NotificationProvider {
  name: string;
  sendFeeReminder(payload: FeeReminderPayload): Promise<NotificationResult>;
}

export class MockNotificationProvider implements NotificationProvider {
  public name = "MOCK_NOTIFICATION_PROVIDER";
  public sentHistory: { payload: FeeReminderPayload; result: NotificationResult }[] = [];
  private failNextTimes = 0;
  private failError: string = "Provider delivery timeout (DLR error 30008)";

  public setFailNext(times: number = 1, error?: string) {
    this.failNextTimes = times;
    if (error) this.failError = error;
  }

  public reset() {
    this.sentHistory = [];
    this.failNextTimes = 0;
    this.failError = "Provider delivery timeout (DLR error 30008)";
  }

  async sendFeeReminder(payload: FeeReminderPayload): Promise<NotificationResult> {
    const sentAt = new Date();

    if (this.failNextTimes > 0) {
      this.failNextTimes--;
      const result: NotificationResult = {
        success: false,
        error: this.failError,
        provider: this.name,
        sentAt,
      };
      this.sentHistory.push({ payload, result });
      return result;
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const result: NotificationResult = {
      success: true,
      messageId,
      provider: this.name,
      sentAt,
    };
    this.sentHistory.push({ payload, result });
    return result;
  }
}

export const mockNotificationProvider = new MockNotificationProvider();

export function getNotificationProvider(): NotificationProvider {
  return mockNotificationProvider;
}
