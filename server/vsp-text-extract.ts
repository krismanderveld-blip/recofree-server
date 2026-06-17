/**
 * VSP Text Extraction Endpoint
 *
 * Accepts base64-encoded DOCX/PDF files and extracts plain text.
 * Used as a preprocessing step before VSP document parsing.
 *
 * For DOCX: uses a simple XML-based extraction (no heavy deps).
 * For PDF: uses a basic text layer extraction.
 */
import type { Request, Response, Express } from 'express';
import { Buffer } from 'buffer';

/**
 * Extract text from a DOCX file (Office Open XML).
 * DOCX is a ZIP containing XML files. The main content is in word/document.xml.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  // Use the built-in 'zlib' approach — DOCX is a ZIP file
  const { Readable } = await import('stream');
  const { createInflateRaw } = await import('zlib');

  // Simple ZIP parser for DOCX — find word/document.xml
  const entries = parseZipEntries(buffer);
  const docEntry = entries.find(e => e.name === 'word/document.xml');
  if (!docEntry) {
    throw new Error('Not a valid DOCX file: word/document.xml not found');
  }

  const xmlContent = docEntry.content.toString('utf-8');

  // Strip XML tags and extract text content
  const text = xmlContent
    // Replace paragraph endings with newlines
    .replace(/<\/w:p>/g, '\n')
    // Replace line breaks
    .replace(/<w:br[^>]*\/>/g, '\n')
    // Extract text from <w:t> tags
    .replace(/<w:t[^>]*>(.*?)<\/w:t>/g, '$1')
    // Remove all remaining XML tags
    .replace(/<[^>]+>/g, '')
    // Decode XML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Clean up excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Minimal ZIP entry parser — extracts file entries from a ZIP buffer.
 * Only supports DEFLATE (method 8) and STORED (method 0).
 */
function parseZipEntries(buffer: Buffer): { name: string; content: Buffer }[] {
  const entries: { name: string; content: Buffer }[] = [];
  let offset = 0;

  while (offset < buffer.length - 4) {
    // Look for local file header signature (PK\x03\x04)
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);

    const name = buffer.slice(offset + 30, offset + 30 + nameLength).toString('utf-8');
    const dataStart = offset + 30 + nameLength + extraLength;
    const compressedData = buffer.slice(dataStart, dataStart + compressedSize);

    let content: Buffer;
    if (compressionMethod === 0) {
      // STORED
      content = compressedData;
    } else if (compressionMethod === 8) {
      // DEFLATE — use sync inflate
      const { inflateRawSync } = require('zlib');
      try {
        content = inflateRawSync(compressedData);
      } catch {
        content = Buffer.alloc(0);
      }
    } else {
      content = Buffer.alloc(0);
    }

    entries.push({ name, content });
    offset = dataStart + compressedSize;
  }

  return entries;
}

export function registerVspTextExtractRoute(app: Express): void {
  app.post('/api/vsp/extract-text', async (req: Request, res: Response) => {
    try {
      const { base64Content, mimeType, fileName } = req.body;

      if (!base64Content || typeof base64Content !== 'string') {
        res.status(400).json({ error: 'base64Content is required' });
        return;
      }

      const buffer = Buffer.from(base64Content, 'base64');
      console.log(`[VspTextExtract] Processing ${fileName} (${mimeType}, ${buffer.length} bytes)`);

      let text: string;

      if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName?.endsWith('.docx')
      ) {
        text = await extractDocxText(buffer);
      } else if (mimeType === 'application/msword' || fileName?.endsWith('.doc')) {
        // Old .doc format — try basic text extraction
        // Extract readable ASCII/UTF-8 strings from the binary
        text = buffer
          .toString('utf-8')
          .replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ')
          .replace(/ {2,}/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      } else if (mimeType === 'application/pdf' || fileName?.endsWith('.pdf')) {
        // Basic PDF text extraction — look for text streams
        const pdfText = buffer.toString('latin1');
        const textParts: string[] = [];

        // Extract text between BT and ET (text objects)
        const btEtRegex = /BT\s([\s\S]*?)ET/g;
        let match;
        while ((match = btEtRegex.exec(pdfText)) !== null) {
          const block = match[1];
          // Extract text from Tj and TJ operators
          const tjRegex = /\(([^)]*)\)\s*Tj/g;
          let tjMatch;
          while ((tjMatch = tjRegex.exec(block)) !== null) {
            textParts.push(tjMatch[1]);
          }
        }

        text = textParts.join('\n').trim();
        if (!text) {
          // Fallback: try to find readable strings
          text = pdfText
            .replace(/[^\x20-\x7E\xC0-\xFF\n]/g, ' ')
            .replace(/ {3,}/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        }
      } else {
        // Fallback: treat as text
        text = buffer.toString('utf-8');
      }

      if (!text || text.trim().length < 10) {
        res.status(422).json({ error: 'Could not extract readable text from the document' });
        return;
      }

      console.log(`[VspTextExtract] Extracted ${text.length} chars from ${fileName}`);
      res.json({ success: true, text });
    } catch (error: any) {
      console.error('[VspTextExtract] Error:', error);
      res.status(500).json({ error: 'Failed to extract text from document' });
    }
  });
}
