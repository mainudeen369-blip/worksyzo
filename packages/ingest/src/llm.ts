import { optionalEnv } from '@worksyzo/db';

export interface EmbedResult {
  vectors: number[][];
  model: string;
  totalTokens: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to .env to enable document embeddings and AI chat.',
    );
  }
  return key;
}

function baseUrl(): string {
  return optionalEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/$/, '');
}

export async function embedTexts(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], model: '', totalTokens: 0 };

  const model = optionalEnv('LLM_EMBED_MODEL', 'text-embedding-3-small');
  const res = await fetch(`${baseUrl()}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
    usage?: { total_tokens?: number };
    model?: string;
  };

  const ordered = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  return {
    vectors: ordered,
    model: json.model || model,
    totalTokens: json.usage?.total_tokens ?? 0,
  };
}

export async function chatCompletion(messages: ChatMessage[]): Promise<ChatResult> {
  const model = optionalEnv('LLM_CHAT_MODEL', 'gpt-4o-mini');
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Chat failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };

  return {
    content: json.choices[0]?.message?.content?.trim() || 'I could not generate an answer.',
    model: json.model || model,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}

/** pgvector literal from a float array. */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}
