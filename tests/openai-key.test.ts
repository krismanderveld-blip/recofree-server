/**
 * Test to validate the OpenAI API key is set and working.
 * Makes a minimal API call to the OpenAI models endpoint.
 */
import { describe, it, expect } from 'vitest';

describe('OpenAI API Key Validation', () => {
  it('should have OPENAI_API_KEY set in environment', () => {
    const key = process.env.OPENAI_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    expect(key!.startsWith('sk-')).toBe(true);
  });

  it('should be able to call OpenAI API with the key', async () => {
    const key = process.env.OPENAI_API_KEY;
    expect(key).toBeDefined();

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${key}`,
      },
    });

    // 200 = valid key, 401 = invalid key
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    // Check that gpt-4o is available
    const modelIds = data.data.map((m: any) => m.id);
    expect(modelIds.some((id: string) => id.includes('gpt-4o'))).toBe(true);
  }, 15000);
});
