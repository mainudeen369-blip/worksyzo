import * as path from 'node:path';
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

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const parsed = await pdfParse(buffer);
    return cleanText(parsed.text || '');
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return cleanText(result.value || '');
  }

  if (
    mimeType.includes('spreadsheet') ||
    mimeType === 'application/vnd.ms-excel' ||
    ext === '.xlsx' ||
    ext === '.xls' ||
    ext === '.csv'
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const parts: string[] = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      parts.push(`# Sheet: ${name}`);
      parts.push(XLSX.utils.sheet_to_csv(sheet));
    }
    return cleanText(parts.join('\n\n'));
  }

  return cleanText(buffer.toString('utf8'));
}

function cleanText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
