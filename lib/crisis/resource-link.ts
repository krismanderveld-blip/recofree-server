export type CrisisLinkPlatform = 'android' | 'ios' | 'web' | 'windows' | 'macos';

export function buildCrisisResourceUrl(
  number: string,
  isText: boolean | undefined,
  platform: CrisisLinkPlatform,
): string | null {
  if (!isText) {
    const cleaned = number.replace(/[^0-9+]/g, '');
    return cleaned ? `tel:${cleaned}` : null;
  }

  const shoutMatch = number.match(/\bSHOUT\s+to\s+(\d+)\b/i);
  if (shoutMatch) {
    const separator = platform === 'ios' ? '&' : '?';
    return `sms:${shoutMatch[1]}${separator}body=SHOUT`;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(number)) return number;
  if (number.includes('.')) return `https://${number}`;

  const cleaned = number.replace(/[^0-9+]/g, '');
  return cleaned ? `sms:${cleaned}` : null;
}
