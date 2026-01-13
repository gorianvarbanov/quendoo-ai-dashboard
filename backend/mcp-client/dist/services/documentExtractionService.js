/**
 * Document Extraction Service - Extract and chunk text from documents
 * Supports: PDF, DOCX, XLSX, XLS, JPG, PNG
 */

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import vision from '@google-cloud/vision';
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
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return await extractTextFromExcel(filePath);
    } else if (
      mimeType === 'image/jpeg' ||
      mimeType === 'image/png'
    ) {
      return await extractTextFromImage(filePath);
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
 * Extract text from Excel file (XLSX/XLS)
 * Converts sheets to markdown tables AND enriched text rows for better search
 * @param {string} filePath - Path to Excel file
 * @returns {Promise<string>} - Extracted text with both markdown tables and enriched rows
 */
async function extractTextFromExcel(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const workbook = XLSX.read(dataBuffer, { type: 'buffer' });

    let fullText = '';

    // Process each sheet
    workbook.SheetNames.forEach((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName];

      // Add sheet header
      fullText += `\n## Sheet: ${sheetName}\n\n`;

      // Convert to JSON array (array of arrays)
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (data.length === 0) {
        fullText += '(Empty sheet)\n';
        return;
      }

      // OPTIMIZATION: Use ONLY enriched text for better search (markdown table is redundant for RAG)
      // This also solves Firestore transaction size limit
      fullText += convertArrayToEnrichedText(data);
      fullText += '\n';
    });

    return fullText;
  } catch (error) {
    console.error('[DocumentExtraction] Error parsing Excel:', error);
    throw new Error(`Failed to parse Excel: ${error.message}`);
  }
}

/**
 * Extract text from image using Google Cloud Vision API (OCR)
 * @param {string} filePath - Path to image file
 * @returns {Promise<string>} - Extracted text from image
 */
async function extractTextFromImage(filePath) {
  try {
    // Initialize Vision client
    const client = new vision.ImageAnnotatorClient();

    // Read image file
    const imageBuffer = await fs.readFile(filePath);

    // Perform text detection
    const [result] = await client.textDetection({
      image: { content: imageBuffer }
    });

    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return '(No text detected in image)';
    }

    // First annotation contains the full text
    const fullText = detections[0].description || '';

    console.log(`[DocumentExtraction] Extracted ${fullText.length} characters from image via OCR`);

    return fullText;
  } catch (error) {
    console.error('[DocumentExtraction] Error performing OCR:', error);
    throw new Error(`Failed to perform OCR: ${error.message}`);
  }
}

/**
 * Convert 2D array to markdown table
 * @param {Array<Array>} data - 2D array of data
 * @returns {string} - Markdown table string
 */
function convertArrayToMarkdownTable(data) {
  if (data.length === 0) return '';

  let markdown = '';

  // Header row
  const headers = data[0];
  markdown += '| ' + headers.map(h => String(h || '').trim()).join(' | ') + ' |\n';

  // Separator row
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  // Data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Ensure row has same length as headers
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }
    markdown += '| ' + paddedRow.slice(0, headers.length).map(cell => String(cell || '').trim()).join(' | ') + ' |\n';
  }

  return markdown;
}

/**
 * Convert 2D array to enriched text with labeled fields
 * This dramatically improves keyword search by adding contextual labels
 * Example: "442231" becomes "Резервация номер: 442231"
 *
 * OPTIMIZED: Compact format to reduce size (Firestore transaction limit)
 *
 * @param {Array<Array>} data - 2D array of data (first row is headers)
 * @returns {string} - Enriched text with labeled fields
 */
function convertArrayToEnrichedText(data) {
  if (data.length === 0) return '';

  const headers = data[0];
  let enrichedText = '';

  // Process each data row (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // Build compact record (one line per field, skip empties)
    const fields = [];
    for (let j = 0; j < headers.length; j++) {
      const header = String(headers[j] || '').trim();
      const value = String(row[j] || '').trim();

      // Skip empty values and headers
      if (!value || !header) continue;

      // Compact format: "Header: value"
      fields.push(`${header}: ${value}`);
    }

    // Add record if it has any fields
    if (fields.length > 0) {
      enrichedText += fields.join(' | ') + '\n\n';
    }
  }

  return enrichedText;
}

/**
 * Parse structured data from Excel table (for advanced filtering and queries)
 * Converts Excel table to JSON array of objects
 *
 * @param {Array<Array>} data - 2D array of data (first row is headers)
 * @returns {Object} - Structured data with schema and records
 */
function parseExcelStructuredData(data) {
  if (data.length === 0) {
    return {
      schema: [],
      records: [],
      recordCount: 0
    };
  }

  const headers = data[0].map(h => String(h || '').trim());
  const records = [];

  // Convert each row to an object
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = row[j];

      // Skip empty headers
      if (!header) continue;

      // Store value (preserve type)
      record[header] = value !== undefined && value !== null ? value : '';
    }

    // Only add non-empty records
    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  }

  // Generate schema (field names and sample values)
  const schema = headers
    .filter(h => h)
    .map(header => ({
      field: header,
      sampleValue: records[0]?.[header] || ''
    }));

  return {
    schema,
    records,
    recordCount: records.length
  };
}

/**
 * Split text into chunks with overlap for better context preservation
 * Uses semantic chunking for better RAG results
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Maximum characters per chunk (default: 1000)
 * @param {number} overlap - Number of overlapping characters (default: 200)
 * @returns {string[]} - Array of text chunks
 */
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  return semanticChunkText(text, chunkSize, overlap);
}

/**
 * Semantic chunking - splits text at natural boundaries (paragraphs, sections, sentences)
 * This provides better context preservation and more meaningful chunks for RAG
 * @param {string} text - Text to chunk
 * @param {number} targetSize - Target characters per chunk
 * @param {number} minOverlap - Minimum overlap between chunks
 * @returns {string[]} - Array of text chunks
 */
export function semanticChunkText(text, targetSize = 1500, minOverlap = 250) {
  // Clean up text but preserve structure
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanedText.length <= targetSize) {
    return [cleanedText];
  }

  const chunks = [];

  // Split by markdown headers (## Header) and double newlines (paragraphs)
  const sections = cleanedText.split(/(?=\n##\s)|(?=\n\n)/);

  let currentChunk = '';
  let previousChunkEnd = ''; // For overlap

  for (const section of sections) {
    const trimmedSection = section.trim();
    if (!trimmedSection) continue;

    // Check if adding this section would exceed max size
    const potentialLength = currentChunk.length + trimmedSection.length;

    if (potentialLength <= targetSize * 1.3) {
      // Add section to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedSection;
    } else {
      // Current chunk is large enough, save it
      if (currentChunk.length >= targetSize * 0.5) {
        // Add overlap from previous chunk
        const chunkWithOverlap = previousChunkEnd + currentChunk;
        chunks.push(chunkWithOverlap.trim());

        // Save end of this chunk for next overlap
        previousChunkEnd = currentChunk.slice(-minOverlap) + '\n\n';
        currentChunk = trimmedSection;
      } else {
        // Current chunk too small, add section anyway
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedSection;
      }
    }

    // If section itself is very large, split it by sentences
    if (trimmedSection.length > targetSize * 1.5) {
      // Save current chunk if any
      if (currentChunk && currentChunk !== trimmedSection) {
        const chunkWithOverlap = previousChunkEnd + currentChunk.replace(trimmedSection, '').trim();
        if (chunkWithOverlap.length > 0) {
          chunks.push(chunkWithOverlap);
          previousChunkEnd = chunkWithOverlap.slice(-minOverlap) + '\n\n';
        }
      }

      // Split large section by sentences
      const sentenceChunks = splitBySentences(trimmedSection, targetSize, minOverlap);
      sentenceChunks.forEach((chunk, idx) => {
        if (idx === 0 && previousChunkEnd) {
          chunks.push(previousChunkEnd + chunk);
        } else {
          chunks.push(chunk);
        }
        previousChunkEnd = chunk.slice(-minOverlap) + '\n\n';
      });

      currentChunk = '';
    }
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    const chunkWithOverlap = previousChunkEnd + currentChunk;
    chunks.push(chunkWithOverlap.trim());
  }

  // Filter out very small chunks (< 100 chars) unless it's the only chunk
  const filtered = chunks.filter((c, idx) => c.length >= 100 || chunks.length === 1);

  return filtered.length > 0 ? filtered : [cleanedText];
}

/**
 * Split text by sentences when sections are too large
 * @param {string} text - Text to split
 * @param {number} targetSize - Target size per chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {string[]} - Array of chunks
 */
function splitBySentences(text, targetSize, overlap) {
  // Split by sentence boundaries (., !, ?, \n)
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];

  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= targetSize * 1.2) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Extract structured data from Excel file (for advanced queries)
 * @param {string} filePath - Path to Excel file
 * @returns {Promise<object>} - Structured data from all sheets
 */
export async function extractStructuredDataFromExcel(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const workbook = XLSX.read(dataBuffer, { type: 'buffer' });

    const allSheets = {};

    // Process each sheet
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Parse structured data for this sheet
      allSheets[sheetName] = parseExcelStructuredData(data);
    });

    return {
      type: 'excel',
      sheetsCount: workbook.SheetNames.length,
      sheets: allSheets,
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[DocumentExtraction] Error extracting structured data from Excel:', error);
    return {
      type: 'excel',
      error: error.message
    };
  }
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
  extractStructuredDataFromExcel,
  getDocumentMetadata
};
