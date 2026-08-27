import { describe, expect, it, vi } from 'vitest';

const proxyJsonMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/minimal-proxy-client', () => ({ callMinimalProxyJson: proxyJsonMock }));

import { callGenerateEigenRegiePlan, convertProposalToPlan } from '@/lib/engine/kim/kerp01-generate-client';

const zone = { signals: [], bodySignals: [], thoughts: [], behaviour: [], whatHelps: [], boundaryActions: [], anchorSentence: '' };

describe('KERP01 client-built minimal proxy', () => {
  it('uses Kim persona, excludes account name and preserves the five-zone contract', async () => {
    proxyJsonMock.mockResolvedValueOnce({
      zones: { donkergroen: zone, lichtgroen: zone, geel: zone, oranje: zone, rood: zone },
      triggers: [{ lossOfRegiePattern: 'redden', healthyResponse: 'pauzeren', boundaryRule: 'veilig begrenzen' }],
      mainAnchorSentence: 'Ik kan nabij blijven zonder mezelf te verliezen.',
    });
    const result = await callGenerateEigenRegiePlan({
      userName: 'AccountNaam', language: 'nl',
      lifeStorySections: [{ title: 'Mijn verhaal', content: 'Ik draag al jaren veel en wil leren nabij te blijven zonder mezelf te verliezen.' }],
    });
    expect(result.success).toBe(true);
    const converted = convertProposalToPlan(result);
    expect(converted).not.toBeNull();
    expect(converted?.zones?.rood).toBeDefined();
    expect(proxyJsonMock).toHaveBeenCalledWith(expect.objectContaining({ persona: 'kim', promptBuildVersion: 'kerp01-plan-client-v2' }));
    expect(JSON.stringify(proxyJsonMock.mock.calls[0][0])).not.toContain('AccountNaam');
  });

  it('rejects an incomplete zone response', async () => {
    proxyJsonMock.mockResolvedValueOnce({ zones: { donkergroen: zone } });
    const result = await callGenerateEigenRegiePlan({
      lifeStorySections: [{ title: 'Verhaal', content: 'Dit verhaal bevat voldoende woorden om een veilig eigen regie plan te kunnen opstellen.' }],
    });
    expect(result.success).toBe(false);
  });
});
