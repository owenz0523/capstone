/**
 * Normalize a phone number to a canonical "+<digits>" form so the same number
 * typed differently matches. 10 digits are assumed to be North American (+1).
 * Returns null if it doesn't look like a phone number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15 && input.trim().startsWith("+")) return `+${digits}`;
  return null;
}

/** Split free text into unique, valid, normalized phone numbers. */
export function parsePhones(text: string): string[] {
  const parts = text.split(/[\n,;]+/);
  return [...new Set(parts.map(normalizePhone).filter((p): p is string => !!p))];
}

/** "+15195551234" -> "(519) 555-1234"; other numbers are left as-is. */
export function formatPhone(p: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}
