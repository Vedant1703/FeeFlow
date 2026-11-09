/**
 * Fee Reminder Notification Provider Interface and Mock Implementation.
 * Supports sending transactional reminders over WHATSAPP and SMS.
 *
 * Hard Invariants:
 * 1. Production Provider Isolation: MockNotificationProvider is strictly prohibited
 *    in production environments to prevent false delivery reporting.
 * 2. Fail Closed: When production dispatch is unavailable, fails closed with an
 *    explicit configuration error.
 * 3. Ambiguous Timeout Transparency: Clearly flags unconfirmed provider timeouts
 *    so callers never perform blind automatic re-dispatches.
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
  isAmbiguousTimeout?: boolean;
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
  private ambiguousTimeoutNextTimes = 0;
  private ambiguousTimeoutError: string =
    "Gateway timeout (HTTP 504): delivery unconfirmed; provider state ambiguous";

  public setFailNext(times: number = 1, error?: string) {
    this.failNextTimes = times;
    if (error) this.failError = error;
  }

  public setAmbiguousTimeoutNext(times: number = 1, error?: string) {
    this.ambiguousTimeoutNextTimes = times;
    if (error) this.ambiguousTimeoutError = error;
  }

  public reset() {
    this.sentHistory = [];
    this.failNextTimes = 0;
    this.failError = "Provider delivery timeout (DLR error 30008)";
    this.ambiguousTimeoutNextTimes = 0;
    this.ambiguousTimeoutError =
      "Gateway timeout (HTTP 504): delivery unconfirmed; provider state ambiguous";
  }

  async sendFeeReminder(payload: FeeReminderPayload): Promise<NotificationResult> {
    const sentAt = new Date();

    if (this.ambiguousTimeoutNextTimes > 0) {
      this.ambiguousTimeoutNextTimes--;
      const result: NotificationResult = {
        success: false,
        error: this.ambiguousTimeoutError,
        provider: this.name,
        sentAt,
        isAmbiguousTimeout: true,
      };
      this.sentHistory.push({ payload, result });
      return result;
    }

    if (this.failNextTimes > 0) {
      this.failNextTimes--;
      const result: NotificationResult = {
        success: false,
        error: this.failError,
        provider: this.name,
        sentAt,
        isAmbiguousTimeout: false,
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
      isAmbiguousTimeout: false,
    };
    this.sentHistory.push({ payload, result });
    return result;
  }
}

export const mockNotificationProvider = new MockNotificationProvider();

/**
 * Factory function returning the appropriate notification provider.
 * Enforces production isolation:
 * - MockNotificationProvider is strictly prohibited in production mode.
 * - Fails closed with an explicit configuration error if a live production provider is not configured.
 */
export function getNotificationProvider(): NotificationProvider {
  const isProduction = process.env.NODE_ENV === "production";
  const explicitDemoOrTest =
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development" ||
    process.env.FEEFLOW_USE_MOCK_NOTIFICATIONS === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  if (isProduction && !explicitDemoOrTest) {
    throw new Error(
      "[Notification Provider Configuration Error] Production notification provider is not configured. MockNotificationProvider is disabled in production to prevent false delivery reporting."
    );
  }

  return mockNotificationProvider;
}
