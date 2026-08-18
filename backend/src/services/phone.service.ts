import { parsePhoneNumberFromString, CountryCode, getCountryCallingCode } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string;          // e.g. +966501234567 or +12025550123
  cleanDigits: string;   // e.g. 966501234567 or 12025550123 (no plus, for WhatsApp REST API / OpenWA)
  nationalNumber: string;
  chatId: string;        // e.g. 966501234567@c.us
  country?: string;
  error?: string;
}

export class PhoneService {
  /**
   * Sanitizes, parses, and normalizes any global phone number into standard E.164 and clean digits.
   * Handles:
   *  - International numbers with + (e.g. +12025550123, +966501234567, +447911123456, +201001234567)
   *  - International numbers without + (e.g. 12025550123, 966501234567, 447911123456, 201001234567)
   *  - Numbers with 00 prefix (e.g. 00966501234567, 0012025550123)
   *  - Local numbers with leading zero (e.g. 0501234567 -> +966501234567)
   *  - Excel cell formatting artifacts (single quotes, quotes, spaces, hyphens, brackets, dots)
   */
  static validateAndFormat(rawPhone: string | number | null | undefined, defaultCountry: CountryCode = 'SA'): PhoneValidationResult {
    if (rawPhone === null || rawPhone === undefined || String(rawPhone).trim() === '') {
      return {
        isValid: false,
        e164: '',
        cleanDigits: '',
        nationalNumber: '',
        chatId: '',
        error: 'Phone number is empty'
      };
    }

    // 1. Clean string: remove quotes, spaces, dashes, parentheses, dots
    let phoneStr = String(rawPhone).trim();
    phoneStr = phoneStr.replace(/^['"]+|['"]+$/g, ''); // strip single/double quotes
    phoneStr = phoneStr.replace(/[\s\(\)\-\.\,\/\\\[\]]/g, ''); // strip punctuation

    // 2. Handle 00 international prefix
    if (phoneStr.startsWith('00')) {
      phoneStr = '+' + phoneStr.slice(2);
    }

    // 3. Attempt direct international parse if starts with +
    if (phoneStr.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(phoneStr);
      if (parsed && parsed.isValid()) {
        const cleanDigits = parsed.number.replace(/\D/g, '');
        return {
          isValid: true,
          e164: parsed.number,
          cleanDigits,
          nationalNumber: parsed.nationalNumber,
          chatId: `${cleanDigits}@c.us`,
          country: parsed.country
        };
      }
    }

    // 4. If doesn't start with +, attempt parsing as international with prepended +
    if (!phoneStr.startsWith('+')) {
      // Try +<digits> directly (for cases like 966501234567, 12025550123, 447911123456, 201001234567)
      const parsedWithPlus = parsePhoneNumberFromString('+' + phoneStr);
      if (parsedWithPlus && parsedWithPlus.isValid()) {
        const cleanDigits = parsedWithPlus.number.replace(/\D/g, '');
        return {
          isValid: true,
          e164: parsedWithPlus.number,
          cleanDigits,
          nationalNumber: parsedWithPlus.nationalNumber,
          chatId: `${cleanDigits}@c.us`,
          country: parsedWithPlus.country
        };
      }

      // 5. Try parsing with default country (for local formats like 0501234567)
      const parsedNational = parsePhoneNumberFromString(phoneStr, defaultCountry);
      if (parsedNational && parsedNational.isValid()) {
        const cleanDigits = parsedNational.number.replace(/\D/g, '');
        return {
          isValid: true,
          e164: parsedNational.number,
          cleanDigits,
          nationalNumber: parsedNational.nationalNumber,
          chatId: `${cleanDigits}@c.us`,
          country: parsedNational.country
        };
      }
    }

    // 6. Resilient International Fallback for Valid Digits Length (7 to 15 digits per ITU E.164)
    const digitsOnly = phoneStr.replace(/\D/g, '');
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      // If starts with 0 and length is 10 (Saudi local format fallback)
      if (digitsOnly.startsWith('05') && digitsOnly.length === 10) {
        const saudiE164 = `+966${digitsOnly.slice(1)}`;
        const cleanDigits = `966${digitsOnly.slice(1)}`;
        return {
          isValid: true,
          e164: saudiE164,
          cleanDigits,
          nationalNumber: digitsOnly.slice(1),
          chatId: `${cleanDigits}@c.us`,
          country: 'SA'
        };
      }

      const e164 = `+${digitsOnly}`;
      return {
        isValid: true,
        e164,
        cleanDigits: digitsOnly,
        nationalNumber: digitsOnly,
        chatId: `${digitsOnly}@c.us`,
        country: undefined
      };
    }

    return {
      isValid: false,
      e164: phoneStr.startsWith('+') ? phoneStr : `+${digitsOnly || phoneStr}`,
      cleanDigits: digitsOnly || phoneStr,
      nationalNumber: digitsOnly || phoneStr,
      chatId: `${digitsOnly}@c.us`,
      error: 'Invalid phone number format or length must be between 7 and 15 digits'
    };
  }

  /**
   * Returns consistent E.164 string (+<country><digits>), e.g. +966501234567 or +12025550123
   */
  static toE164(rawPhone: string | number): string {
    const res = this.validateAndFormat(rawPhone);
    return res.e164;
  }

  /**
   * Returns consistent digits-only string without plus (for WhatsApp REST / Meta API / OpenWA), e.g. 966501234567 or 12025550123
   */
  static toCleanDigits(rawPhone: string | number): string {
    const res = this.validateAndFormat(rawPhone);
    return res.cleanDigits || String(rawPhone).replace(/\D/g, '');
  }

  /**
   * Returns WhatsApp chatId format, e.g. 966501234567@c.us
   */
  static toChatId(rawPhone: string | number): string {
    const digits = this.toCleanDigits(rawPhone);
    return `${digits}@c.us`;
  }
}
