export class SafetyService {
  // Opt-out trigger keywords in Arabic and English (as specified in setup guide)
  private static OPT_OUT_KEYWORDS = [
    'stop',
    'unsubscribe',
    'cancel',
    'إيقاف',
    'ايقاف',
    'وقف',
    'الغاء',
    'إلغاء',
    'خروج',
    'توقف'
  ];

  /**
   * Checks if an incoming message body is an unsubscribe/opt-out command
   */
  static isOptOutMessage(messageText: string): boolean {
    if (!messageText) return false;
    const cleanText = messageText.trim().toLowerCase();
    return this.OPT_OUT_KEYWORDS.some(kw => cleanText === kw || cleanText.startsWith(kw));
  }

  /**
   * Checks if current time is within Quiet Hours (e.g. 23:00 to 08:00)
   */
  static isQuietHours(
    timezone: string = 'Asia/Riyadh',
    startHour: number = 23,
    endHour: number = 8
  ): boolean {
    try {
      const now = new Date();
      const localTimeString = now.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false });
      const currentHour = parseInt(localTimeString.split(':')[0], 10);

      if (startHour > endHour) {
        // Overnight span (e.g., 23:00 to 08:00)
        return currentHour >= startHour || currentHour < endHour;
      } else {
        return currentHour >= startHour && currentHour < endHour;
      }
    } catch {
      return false;
    }
  }

  /**
   * Calculate random jitter delay between min and max seconds
   */
  static calculateJitterDelay(minSeconds: number = 3, maxSeconds: number = 8): number {
    return Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
  }
}
