/**
 * Shared helper for generating crisis number text in AI prompts.
 * Used by both elias and kim prompt-block crisis instructions.
 */

const CRISIS_NUMBERS_PROMPT: Record<string, { suicide: Record<string, { name: string; number: string }>; emergency: string; extra?: Record<string, { name: string; number: string }[]> }> = {
  BE: {
    suicide: { nl: { name: 'Zelfmoordlijn', number: '1813' }, fr: { name: 'Centre de Prévention du Suicide', number: '0800 32 123' }, en: { name: 'Suicide Prevention', number: '1813' } },
    emergency: '112',
    extra: { nl: [{ name: 'huiselijk geweld', number: '1712' }], fr: [{ name: 'violence domestique', number: '1712' }], en: [{ name: 'domestic violence', number: '1712' }] },
  },
  NL: {
    suicide: { nl: { name: '113 Zelfmoordpreventie', number: '113' }, en: { name: 'Suicide Prevention', number: '113' }, fr: { name: 'Prévention du suicide', number: '113' } },
    emergency: '112',
  },
  FR: {
    suicide: { fr: { name: 'SOS Amitié', number: '09 72 39 40 50' }, nl: { name: 'SOS Amitié', number: '09 72 39 40 50' }, en: { name: 'SOS Amitié', number: '09 72 39 40 50' } },
    emergency: '112',
  },
  UK: {
    suicide: { en: { name: 'Samaritans', number: '116 123' }, nl: { name: 'Samaritans', number: '116 123' }, fr: { name: 'Samaritans', number: '116 123' } },
    emergency: '999',
  },
  US: {
    suicide: { en: { name: 'Suicide & Crisis Lifeline', number: '988' }, nl: { name: 'Suicide & Crisis Lifeline', number: '988' }, fr: { name: 'Suicide & Crisis Lifeline', number: '988' } },
    emergency: '911',
  },
};

export function getCrisisNumbersForPrompt(country?: string, locale?: string): { footerLine: string; numbersList: string } {
  const c = country || 'BE';
  const l = locale || 'nl';
  const data = CRISIS_NUMBERS_PROMPT[c] || CRISIS_NUMBERS_PROMPT['BE'];
  const suicideEntry = data.suicide[l] || data.suicide['nl'] || Object.values(data.suicide)[0];
  const extraEntries = data.extra?.[l] || data.extra?.['nl'] || [];

  // Build footer line
  let footerLine: string;
  if (l === 'nl') {
    footerLine = `Je kan ook bellen naar ${suicideEntry.name}: ${suicideEntry.number} (24/7, gratis en anoniem)`;
    if (extraEntries.length > 0) footerLine += `, ${extraEntries.map(e => `${e.number} (${e.name})`).join(', ')}`;
    footerLine += ` of ${data.emergency} bij onmiddellijk gevaar.`;
  } else if (l === 'fr') {
    footerLine = `Tu peux aussi appeler ${suicideEntry.name}: ${suicideEntry.number} (24/7, gratuit et anonyme)`;
    if (extraEntries.length > 0) footerLine += `, ${extraEntries.map(e => `${e.number} (${e.name})`).join(', ')}`;
    footerLine += ` ou ${data.emergency} en cas de danger immédiat.`;
  } else {
    footerLine = `You can also call ${suicideEntry.name}: ${suicideEntry.number} (24/7, free and anonymous)`;
    if (extraEntries.length > 0) footerLine += `, ${extraEntries.map(e => `${e.number} (${e.name})`).join(', ')}`;
    footerLine += ` or ${data.emergency} for immediate danger.`;
  }

  // Build numbers list
  let numbersList = `- ${suicideEntry.number} (${suicideEntry.name} — 24/7)`;
  for (const extra of extraEntries) {
    numbersList += `\n- ${extra.number} (${extra.name})`;
  }
  numbersList += `\n- ${data.emergency} (${l === 'nl' ? 'noodgevallen' : l === 'fr' ? 'urgences' : 'emergency'} — ${l === 'nl' ? 'alleen bij onmiddellijk gevaar' : l === 'fr' ? 'danger immédiat uniquement' : 'immediate danger only'})`;

  return { footerLine, numbersList };
}
