import { describe, it, expect } from 'vitest';

describe('OpenAI API Key Validation', () => {
  it('should have a valid OPENAI_API_KEY that authenticates with OpenAI', async () => {
    const key = process.env.OPENAI_API_KEY;
    expect(key).toBeDefined();
    expect(key!.startsWith('sk-')).toBe(true);

    // Lightweight models endpoint call to validate the key
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${key}`,
      },
    });

    expect(response.status).toBe(200);
  });
});
