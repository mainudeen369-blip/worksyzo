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

export interface ProviderConfig {
  provider: 'openai' | 'groq' | 'gemini' | 'openrouter' | 'local';
  apiKey?: string;
  baseUrl: string;
  chatModel: string;
  embedModel: string;
}

export function detectProvider(): ProviderConfig {
  const explicit = optionalEnv('LLM_PROVIDER', '').toLowerCase();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (explicit === 'groq' || (!openaiKey && groqKey)) {
    return {
      provider: 'groq',
      apiKey: groqKey || openaiKey,
      baseUrl: optionalEnv('OPENAI_BASE_URL', 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
      chatModel: optionalEnv('LLM_CHAT_MODEL', 'llama-3.3-70b-versatile'),
      embedModel: optionalEnv('LLM_EMBED_MODEL', 'text-embedding-3-small'),
    };
  }

  if (explicit === 'gemini' || (!openaiKey && geminiKey)) {
    return {
      provider: 'gemini',
      apiKey: geminiKey || openaiKey,
      baseUrl: optionalEnv(
        'OPENAI_BASE_URL',
        'https://generativelanguage.googleapis.com/v1beta/openai',
      ).replace(/\/$/, ''),
      chatModel: optionalEnv('LLM_CHAT_MODEL', 'gemini-1.5-flash'),
      embedModel: optionalEnv('LLM_EMBED_MODEL', 'text-embedding-004'),
    };
  }

  if (explicit === 'openrouter' || (!openaiKey && openrouterKey)) {
    return {
      provider: 'openrouter',
      apiKey: openrouterKey || openaiKey,
      baseUrl: optionalEnv('OPENAI_BASE_URL', 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
      chatModel: optionalEnv('LLM_CHAT_MODEL', 'meta-llama/llama-3.3-70b-instruct:free'),
      embedModel: optionalEnv('LLM_EMBED_MODEL', 'text-embedding-3-small'),
    };
  }

  if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      baseUrl: optionalEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/$/, ''),
      chatModel: optionalEnv('LLM_CHAT_MODEL', 'gpt-4o-mini'),
      embedModel: optionalEnv('LLM_EMBED_MODEL', 'text-embedding-3-small'),
    };
  }

  return {
    provider: 'local',
    baseUrl: '',
    chatModel: 'local-semantic-extractor',
    embedModel: 'local-hash-vectorizer-1536',
  };
}

export function isAiConfigured(): boolean {
  const p = detectProvider();
  return Boolean(p.apiKey || p.provider === 'local');
}

/**
 * Deterministic local embedding for zero-cost / offline / free fallback.
 * Generates a normalized 1536-dimensional vector using token frequencies + n-gram hashing.
 */
export function generateLocalEmbedding(text: string, dimensions = 1536): number[] {
  const vec = new Float64Array(dimensions);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);

  if (words.length === 0) {
    vec[0] = 1;
    return Array.from(vec);
  }

  // Word token hashing
  for (const word of words) {
    let h1 = 5381;
    let h2 = 2166136261;
    for (let i = 0; i < word.length; i++) {
      const code = word.charCodeAt(i);
      h1 = ((h1 << 5) + h1) ^ code;
      h2 = Math.imul(h2 ^ code, 16777619);
    }
    const idx1 = Math.abs(h1) % dimensions;
    const idx2 = Math.abs(h2) % dimensions;
    vec[idx1] = (vec[idx1] ?? 0) + 1.0;
    vec[idx2] = (vec[idx2] ?? 0) + 0.5;
  }

  // 3-gram subword hashing for typo and morphological tolerance
  for (let i = 0; i < normalized.length - 2; i++) {
    const tri = normalized.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < 3; j++) {
      h = (h << 5) - h + tri.charCodeAt(j);
      h |= 0;
    }
    const idx = Math.abs(h) % dimensions;
    vec[idx] = (vec[idx] ?? 0) + 0.2;
  }

  // L2 unit normalization
  let normSq = 0;
  for (let i = 0; i < dimensions; i++) {
    normSq += vec[i]! * vec[i]!;
  }
  const norm = Math.sqrt(normSq) || 1;
  const result = new Array<number>(dimensions);
  for (let i = 0; i < dimensions; i++) {
    result[i] = Number((vec[i]! / norm).toFixed(6));
  }
  return result;
}

export async function embedTexts(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], model: '', totalTokens: 0 };

  const provider = detectProvider();

  // If local or no API key, use built-in local vectorizer
  if (!provider.apiKey || provider.provider === 'local') {
    return {
      vectors: texts.map((t) => generateLocalEmbedding(t, 1536)),
      model: 'local-hash-vectorizer-1536',
      totalTokens: texts.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
    };
  }

  try {
    const res = await fetch(`${provider.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: provider.embedModel, input: texts }),
    });

    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.warn(`Remote embedding returned ${res.status}: ${body.slice(0, 120)}. Falling back to local vectorizer.`);
      return {
        vectors: texts.map((t) => generateLocalEmbedding(t, 1536)),
        model: 'local-hash-vectorizer-1536-fallback',
        totalTokens: texts.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
      };
    }

    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
      usage?: { total_tokens?: number };
      model?: string;
    };

    let ordered = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);

    // If embedding dimension is not 1536 (e.g. Gemini 768), pad or truncate to 1536
    ordered = ordered.map((vec) => {
      if (vec.length === 1536) return vec;
      if (vec.length > 1536) return vec.slice(0, 1536);
      const padded = new Array<number>(1536).fill(0);
      for (let i = 0; i < vec.length; i++) padded[i] = vec[i]!;
      return padded;
    });

    return {
      vectors: ordered,
      model: json.model || provider.embedModel,
      totalTokens: json.usage?.total_tokens ?? 0,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Embedding request failed. Using local vectorizer fallback:', (err as Error).message);
    return {
      vectors: texts.map((t) => generateLocalEmbedding(t, 1536)),
      model: 'local-hash-vectorizer-1536-fallback',
      totalTokens: texts.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
    };
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  contextSnippets: { title: string; excerpt: string; chunkIndex: number }[] = [],
): Promise<ChatResult> {
  const provider = detectProvider();

  if (provider.apiKey) {
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.chatModel,
          temperature: 0.2,
          messages,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          choices: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          model?: string;
        };

        const content = json.choices[0]?.message?.content?.trim();
        if (content) {
          return {
            content,
            model: json.model || provider.chatModel,
            promptTokens: json.usage?.prompt_tokens ?? 0,
            completionTokens: json.usage?.completion_tokens ?? 0,
          };
        }
      } else {
        const body = await res.text();
        // eslint-disable-next-line no-console
        console.warn(`Remote chat failed (${res.status}): ${body.slice(0, 150)}. Using local synthesis.`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Remote chat request error. Using local synthesis:', (err as Error).message);
    }
  }

  // Local Intelligent Synthesizer Fallback
  const userMsg = messages.find((m) => m.role === 'user')?.content || '';
  const question = userMsg.replace(/^Organization context:[\s\S]*?Question:\s*/i, '').trim();

  let answer = '';
  if (contextSnippets.length === 0) {
    answer = `I could not find relevant information in the organization documents for "${question}". Please upload relevant policies or files to the Documents section.`;
  } else {
    answer = `Based on your organization documents for **"${question}"**:\n\n`;
    contextSnippets.slice(0, 4).forEach((snip, idx) => {
      const cleanExcerpt = snip.excerpt.replace(/\s+/g, ' ').trim();
      answer += `• **[#${idx + 1}] ${snip.title}:** ${cleanExcerpt}\n\n`;
    });
    answer += `*(Answer synthesized via local document search. Connect Groq, Gemini, or OpenAI API key in settings for generative conversational mode.)*`;
  }

  return {
    content: answer,
    model: 'local-intelligent-synthesizer',
    promptTokens: Math.ceil(userMsg.length / 4),
    completionTokens: Math.ceil(answer.length / 4),
  };
}

/** pgvector literal from a float array. */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}
