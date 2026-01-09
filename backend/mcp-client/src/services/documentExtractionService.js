/**
 * Document Extraction Service - Extract and chunk text from PDF/DOCX files
 * Supports: PDF, DOCX
 */

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs/promises';

/**
 * Extract text from a file based on its type
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromFile(filePath, mimeType) {
  try {
    console.log(`[DocumentExtraction] Extracting text from ${filePath} (${mimeType})`);

    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(filePath);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      return await extractTextFromDOCX(filePath);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error('[DocumentExtraction] Error extracting text:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Extract text from PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('[DocumentExtraction] Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Extract text from DOCX file
 * @param {string} filePath - Path to DOCX file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromDOCX(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    return result.value;
  } catch (error) {
    console.error('[DocumentExtraction] Error parsing DOCX:', error);
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
}

/**
 * Split text into chunks with overlap for better context preservation
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Maximum characters per chunk (default: 1000)
 * @param {number} overlap - Number of overlapping characters (default: 200)
 * @returns {string[]} - Array of text chunks
 */
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  // Clean up text - remove excessive whitespace
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();

  if (cleanedText.length <= chunkSize) {
    return [cleanedText];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    // Calculate end index for this chunk
    let endIndex = startIndex + chunkSize;

    // If this is not the last chunk, try to break at a sentence or word boundary
    if (endIndex < cleanedText.length) {
      // Try to find a sentence boundary (., !, ?)
      const sentenceEnd = cleanedText.lastIndexOf('.', endIndex);
      const questionEnd = cleanedText.lastIndexOf('?', endIndex);
      const exclamationEnd = cleanedText.lastIndexOf('!', endIndex);

      const sentenceBoundary = Math.max(sentenceEnd, questionEnd, exclamationEnd);

      if (sentenceBoundary > startIndex + chunkSize / 2) {
        // Found a good sentence boundary
        endIndex = sentenceBoundary + 1;
      } else {
        // Fall back to word boundary
        const wordBoundary = cleanedText.lastIndexOf(' ', endIndex);
        if (wordBoundary > startIndex + chunkSize / 2) {
          endIndex = wordBoundary;
        }
      }
    }

    // Extract chunk
    const chunk = cleanedText.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move to next chunk with overlap
    startIndex = endIndex - overlap;

    // Ensure we don't go backwards
    if (startIndex <= chunks[chunks.length - 1]?.length) {
      startIndex = endIndex;
    }
  }

  return chunks;
}

/**
 * Extract structured data from document text using patterns
 * @param {string} text - Document text
 * @param {string} documentType - Type of document (contract, invoice, etc.)
 * @returns {object} - Structured data extracted from document
 */
export function extractStructuredData(text, documentType) {
  const structuredData = {
    documentType,
    extractedAt: new Date().toISOString()
  };

  // Contract-specific extraction
  if (documentType === 'contract') {
    // Extract dates (common date patterns)
    const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g;
    const dates = text.match(datePattern);
    if (dates && dates.length > 0) {
      structuredData.dates = dates;
    }

    // Extract amounts (currency patterns)
    const amountPattern = /(?:USD|EUR|BGN|лв\.?)\s*\d+(?:[,\.]\d{3})*(?:[,\.]\d{2})?|\d+(?:[,\.]\d{3})*(?:[,\.]\d{2})?\s*(?:USD|EUR|BGN|лв\.?)/gi;
    const amounts = text.match(amountPattern);
    if (amounts && amounts.length > 0) {
      structuredData.amounts = amounts;
    }

    // Extract email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailPattern);
    if (emails && emails.length > 0) {
      structuredData.emails = emails;
    }

    // Extract phone numbers
    const phonePattern = /(?:\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
    const phones = text.match(phonePattern);
    if (phones && phones.length > 0) {
      structuredData.phones = phones;
    }
  }

  // Invoice-specific extraction
  if (documentType === 'invoice') {
    // Extract invoice number
    const invoiceNumberPattern = /(?:invoice|inv|number|no|№)[\s:#]*([A-Z0-9\-\/]+)/gi;
    const invoiceMatch = text.match(invoiceNumberPattern);
    if (invoiceMatch && invoiceMatch.length > 0) {
      structuredData.invoiceNumber = invoiceMatch[0];
    }

    // Extract amounts
    const amountPattern = /(?:total|amount|sum|сума|общо)[\s:]*(?:USD|EUR|BGN|лв\.?)?\s*\d+(?:[,\.]\d{3})*(?:[,\.]\d{2})?/gi;
    const amounts = text.match(amountPattern);
    if (amounts && amounts.length > 0) {
      structuredData.amounts = amounts;
    }
  }

  return structuredData;
}

/**
 * Get document metadata summary
 * @param {string} text - Full document text
 * @returns {object} - Metadata summary
 */
export function getDocumentMetadata(text) {
  const words = text.split(/\s+/).length;
  const characters = text.length;
  const lines = text.split('\n').length;

  return {
    wordCount: words,
    characterCount: characters,
    lineCount: lines,
    estimatedReadingTimeMinutes: Math.ceil(words / 200) // Average reading speed
  };
}

export default {
  extractTextFromFile,
  chunkText,
  extractStructuredData,
  getDocumentMetadata
};
