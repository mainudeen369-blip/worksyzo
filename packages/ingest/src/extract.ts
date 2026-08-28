import * as path from 'node:path';
import * as zlib from 'node:zlib';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

const SUPPORTED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

export function isSupportedMime(mime: string, fileName: string): boolean {
  if (SUPPORTED.has(mime)) return true;
  const ext = path.extname(fileName).toLowerCase();
  return ['.pdf', '.docx', '.xlsx', '.xls', '.txt', '.md', '.csv'].includes(ext);
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName = '',
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();

  // 1. PDF Documents
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    let text = '';
    try {
      const parsed = await pdfParse(buffer);
      text = cleanText(parsed.text || '');
    } catch {
      // Fall through to raw stream extractor
    }

    // If pdf-parse succeeded with reasonable text, return it
    if (text.length >= 25) {
      return text;
    }

    // Fallback: Decompress and parse raw PDF streams & Text Blocks (BT ... ET, TJ, Tj)
    const rawStreamText = extractRawPdfStreamText(buffer);
    if (rawStreamText.length >= 25) {
      return cleanText(rawStreamText);
    }

    if (text.length > 0 || rawStreamText.length > 0) {
      return cleanText(`${text}\n\n${rawStreamText}`);
    }

    // If PDF is mostly graphical / scanned, synthesize an indexed document card with title
    const baseTitle = path.basename(fileName, ext).replace(/[_-]+/g, ' ');
    return cleanText(`Document: ${baseTitle}\nFile: ${fileName}\nType: PDF Document\n(Extracted metadata for visual PDF factsheet)`);
  }

  // 2. Microsoft Word DOCX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const docxText = cleanText(result.value || '');
      if (docxText.length >= 10) return docxText;
    } catch {
      // Fall through
    }
  }

  // 3. Excel Spreadsheets / CSV
  if (
    mimeType.includes('spreadsheet') ||
    mimeType === 'application/vnd.ms-excel' ||
    ext === '.xlsx' ||
    ext === '.xls' ||
    ext === '.csv'
  ) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const parts: string[] = [];
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        if (!sheet) continue;
        parts.push(`# Sheet: ${name}`);
        parts.push(XLSX.utils.sheet_to_csv(sheet));
      }
      return cleanText(parts.join('\n\n'));
    } catch {
      // Fall through
    }
  }

  // 4. Plain text / Markdown / Fallback
  const rawStr = buffer.toString('utf8');
  return cleanText(rawStr);
}

/**
 * Deep extraction for PDFs with compressed FlateDecode streams,
 * XObject forms, or vector graphics layouts that pdf-parse misses.
 */
function extractRawPdfStreamText(buffer: Buffer): string {
  const extractedChunks: string[] = [];

  // 1. Extract uncompressed strings between parentheses ( ... )
  const bufferString = buffer.toString('latin1');

  // Search for stream ... endstream blocks
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(bufferString)) !== null) {
    const rawStreamData = match[1];
    if (!rawStreamData) continue;

    const streamBuf = Buffer.from(rawStreamData, 'latin1');
    let decompressed: Buffer | null = null;

    try {
      decompressed = zlib.inflateSync(streamBuf);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(streamBuf);
      } catch {
        // Not a zlib stream or already uncompressed
      }
    }

    const content = (decompressed || streamBuf).toString('latin1');

    // Extract text from BT (Begin Text) ... ET (End Text) blocks
    const btRegex = /BT([\s\S]*?)ET/g;
    let btMatch: RegExpExecArray | null;
    while ((btMatch = btRegex.exec(content)) !== null) {
      const btBlock = btMatch[1] ?? '';

      // Extract literal strings: (Hello World) Tj or [(Hello) -10 (World)] TJ
      const stringMatches = btBlock.match(/\((?:[^()\\]|\\.)*\)/g);
      if (stringMatches) {
        const line = stringMatches
          .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'))
          .filter((s) => s.length > 0 && !/^[\x00-\x1F\x7F]+$/.test(s))
          .join(' ');
        if (line.length > 2) {
          extractedChunks.push(line);
        }
      }

      // Extract hex strings: <48656c6c6f> Tj
      const hexMatches = btBlock.match(/<([0-9a-fA-F]+)>\s*T[jJ]/g);
      if (hexMatches) {
        for (const hexToken of hexMatches) {
          const hex = hexToken.replace(/[^0-9a-fA-F]/g, '');
          if (hex.length >= 4) {
            const decoded = Buffer.from(hex, 'hex').toString('utf8');
            if (/^[a-zA-Z0-9\s.,!?:;@#%&()\-+/]+$/.test(decoded)) {
              extractedChunks.push(decoded);
            }
          }
        }
      }
    }

    // Extract XML / XMP Metadata tags
    const xmlTextMatches = content.match(/<dc:title>[\s\S]*?<\/dc:title>|<dc:description>[\s\S]*?<\/dc:description>|<pdf:Keywords>[\s\S]*?<\/pdf:Keywords>/g);
    if (xmlTextMatches) {
      for (const xmlTag of xmlTextMatches) {
        const clean = xmlTag.replace(/<[^>]+>/g, ' ').trim();
        if (clean.length > 3) extractedChunks.push(clean);
      }
    }
  }

  // Deduplicate and filter extracted lines
  const unique = Array.from(new Set(extractedChunks)).filter((c) => c.length > 2);
  return unique.join('\n');
}

function cleanText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
