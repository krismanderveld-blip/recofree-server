/**
 * VSP Text Extraction Endpoint
 *
 * Accepts base64-encoded DOCX/PDF files and extracts plain text.
 * Used as a preprocessing step before VSP document parsing.
 *
 * For DOCX: uses mammoth for reliable extraction.
 * For PDF: uses basic text layer extraction (fallback).
 */
import type { Request, Response, Express } from 'express';
import { Buffer } from 'buffer';
import * as mammoth from 'mammoth';

/**
 * Extract text from a DOCX file using mammoth (robust, handles complex docs).
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (result.messages && result.messages.length > 0) {
    console.log(`[VspTextExtract] Mammoth messages:`, result.messages.slice(0, 5));
  }
  return text;
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
        console.error(`[VspTextExtract] FAILED: Could not extract text from ${fileName}. Buffer size: ${buffer.length}, extracted length: ${text?.length ?? 0}`);
        res.status(422).json({ error: 'Could not extract readable text from the document' });
        return;
      }

      console.log(`[VspTextExtract] SUCCESS: Extracted ${text.length} chars from ${fileName}`);
      // Log first 200 chars for debugging
      console.log(`[VspTextExtract] Preview: ${text.slice(0, 200).replace(/\n/g, ' | ')}`);
      res.json({ success: true, text });
    } catch (error: any) {
      console.error('[VspTextExtract] Error:', error);
      res.status(500).json({ error: 'Failed to extract text from document' });
    }
  });
}
