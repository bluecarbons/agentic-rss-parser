import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyzer } from '../src/adapters/provider.js';

test('createAnalyzer — accepts custom promptTemplate as function or string', async () => {
  let capturedBody = null;

  // Mock global fetch for this test
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capturedBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'relevant',
                confidence: 99,
                summary: 'Custom prompt test',
                impact: 'Verified custom prompt',
                actionItems: [],
                tags: ['custom']
              })
            }
          }
        ]
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const analyzer = await createAnalyzer({
      provider: 'openai',
      apiKey: 'test-key',
      systemPrompt: 'Custom System Prompt for Cybersecurity CVE Analysis',
      promptTemplate: 'ANALYZE THIS VULNERABILITY: {{title}} | Details: {{snippet}}'
    });

    const result = await analyzer({
      item: { title: 'CVE-2026-1234', contentSnippet: 'Zero-day vulnerability discovered' },
      context: ''
    });

    assert.equal(result.decision, 'relevant');
    assert.equal(capturedBody.messages[0].content, 'Custom System Prompt for Cybersecurity CVE Analysis');
    assert.equal(capturedBody.messages[1].content, 'ANALYZE THIS VULNERABILITY: CVE-2026-1234 | Details: Zero-day vulnerability discovered');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
