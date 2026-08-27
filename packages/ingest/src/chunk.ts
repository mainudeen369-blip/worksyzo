export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

/** Rough token estimate: ~4 chars per token for English business prose. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Sliding-window chunker. Targets ~600 tokens with ~80 token overlap so
 * policy sentences that straddle boundaries still retrieve.
 */
export function chunkText(text: string, targetTokens = 600, overlapTokens = 80): TextChunk[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;
  const chunks: TextChunk[] = [];

  let start = 0;
  let index = 0;
  while (start < cleaned.length) {
    let end = Math.min(cleaned.length, start + targetChars);
    if (end < cleaned.length) {
      // Prefer breaking on paragraph, then sentence, then space.
      const window = cleaned.slice(start, end);
      const para = window.lastIndexOf('\n\n');
      const sentence = window.lastIndexOf('. ');
      const space = window.lastIndexOf(' ');
      const breakAt =
        para > targetChars * 0.4
          ? para + 2
          : sentence > targetChars * 0.4
            ? sentence + 2
            : space > targetChars * 0.4
              ? space + 1
              : window.length;
      end = start + breakAt;
    }

    const content = cleaned.slice(start, end).trim();
    if (content) {
      chunks.push({ index, content, tokenCount: estimateTokens(content) });
      index += 1;
    }

    if (end >= cleaned.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}
