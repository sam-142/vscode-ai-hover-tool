const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface ExplainRequest {
  apiKey: string;
  model: string;
  maxTokens: number;
  word: string;
  languageId: string;
  contextCode: string;
}

export async function explainKeyword(
  req: ExplainRequest,
  signal: AbortSignal
): Promise<string> {
  const systemPrompt =
    'You are an inline code-hover assistant embedded in an editor tooltip. ' +
    'Given a word/keyword and a snippet of surrounding code, respond with exactly two short markdown sections: ' +
    '"**Definition**" (a general, language-aware explanation of what the keyword/identifier/construct means, 1-2 sentences) and ' +
    '"**In this code**" (a specific, concrete explanation of what role it plays in the given snippet, 1-2 sentences). ' +
    'Be concise and accurate. No preamble, no code fences, no extra sections.';

  const userPrompt =
    `Language: ${req.languageId}\n` +
    `Hovered word: \`${req.word}\`\n\n` +
    'Surrounding code:\n```' +
    req.languageId +
    '\n' +
    req.contextCode +
    '\n```';

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`
    },
    body: JSON.stringify({
      model: req.model,
      temperature: 0.2,
      max_tokens: req.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Groq API returned an empty response.');
  }
  return content;
}
