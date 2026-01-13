/**
 * Document Management API Routes
 * Handles document upload, listing, and deletion with vector embeddings
 */

import express from 'express';
import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import { createDocument, getDocuments, deleteDocument } from '../models/HotelDocument.js';
import { extractTextFromFile, chunkText, extractStructuredData, extractStructuredDataFromExcel, getDocumentMetadata } from '../services/documentExtractionService.js';
import { generateEmbeddingsBatch } from '../services/embeddingService.js';
import { requireHotelAuth } from '../auth/hotelAuthMiddleware.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const router = express.Router();

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'quendoo-ai-dashboard'
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'quendoo-hotel-documents';

// Configure multer for file uploads (store in temp directory)
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB limit (for Excel files)
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, DOCX, Excel, and Images
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.ms-excel', // XLS
      'image/jpeg', // JPG
      'image/png' // PNG
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      // Additional size validation for images (5MB max)
      if ((file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') && req.headers['content-length'] > 5 * 1024 * 1024) {
        cb(new Error('Image files must be less than 5 MB.'));
      } else {
        cb(null, true);
      }
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOCX, XLSX, XLS, JPG, PNG.'));
    }
  }
});

/**
 * POST /api/documents/upload
 * Upload a document and process it for RAG
 * Requires: hotel authentication
 */
router.post('/upload', requireHotelAuth, upload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    // Use JWT hotelId for document storage (secure, no API key exposure)
    const hotelId = req.hotel.hotelId;
    const file = req.file;
    const { documentType, tags, description } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    tempFilePath = file.path;

    // Fix UTF-8 encoding for filenames with Cyrillic characters
    // Multer may not decode the filename correctly from multipart/form-data
    let fileName = file.originalname;
    try {
      // If filename is garbled (contains �), try to fix it
      if (fileName.includes('�')) {
        // Try to decode as latin1 and re-encode as utf-8
        const buffer = Buffer.from(fileName, 'latin1');
        fileName = buffer.toString('utf8');
      }
    } catch (error) {
      console.warn(`[Documents] Could not fix encoding for filename: ${error.message}`);
    }

    console.log(`[Documents] Processing upload for hotel ${hotelId}: ${fileName}`);

    // Step 1: Extract text from document
    console.log('[Documents] Extracting text...');
    const fullText = await extractTextFromFile(tempFilePath, file.mimetype);

    // Step 2: Chunk text for embeddings
    console.log('[Documents] Chunking text...');
    // Using subcollection storage - no size limit per document
    // Optimal chunk size for semantic search: 1000-2000 characters
    const textChunks = chunkText(fullText, 1500, 250);
    console.log(`[Documents] Created ${textChunks.length} chunks`);

    // Step 3: Generate embeddings for each chunk
    console.log('[Documents] Generating embeddings...');
    const embeddings = await generateEmbeddingsBatch(textChunks);
    console.log(`[Documents] Generated ${embeddings.length} embeddings`);

    // Step 4: Extract structured data
    console.log('[Documents] Extracting structured data...');
    let structuredData = extractStructuredData(fullText, documentType);

    // For Excel files, also extract structured table data
    const isExcel = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.mimetype === 'application/vnd.ms-excel';

    if (isExcel) {
      console.log('[Documents] Extracting structured data from Excel...');
      const excelStructuredData = await extractStructuredDataFromExcel(tempFilePath);
      structuredData = {
        ...structuredData,
        excel: excelStructuredData
      };
    }

    const metadata = getDocumentMetadata(fullText);

    // Step 5: Upload file to Google Cloud Storage
    console.log('[Documents] Uploading to Cloud Storage...');
    // Note: hotelId already contains 'hotel_' prefix from JWT token
    const storagePath = `${hotelId}/${Date.now()}_${fileName}`;
    const bucket = storage.bucket(BUCKET_NAME);
    const blob = bucket.file(storagePath);

    await blob.save(await fs.readFile(tempFilePath), {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          hotelId,
          originalName: fileName
        }
      }
    });

    // Make file accessible (or keep private based on requirements)
    const storageUrl = `gs://${BUCKET_NAME}/${storagePath}`;

    // Step 6: Save document with embeddings to Firestore
    console.log('[Documents] Saving to Firestore...');
    const document = await createDocument(hotelId, {
      fileName: fileName,
      fileType: file.mimetype,
      documentType: documentType || 'other',
      storageUrl,
      storagePath,
      fullText,
      textChunks,
      embeddings,
      structuredData: {
        ...structuredData,
        ...metadata
      },
      fileSize: file.size,
      mimeType: file.mimetype,
      tags: tags ? JSON.parse(tags) : [],
      description: description || ''
    });

    // Clean up temp file
    await fs.unlink(tempFilePath);

    console.log(`[Documents] Document ${document.id} uploaded successfully`);

    res.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        fileSize: document.fileSize,
        chunksCount: textChunks.length,
        metadata: metadata
      }
    });
  } catch (error) {
    console.error('[Documents] Upload error:', error);

    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('[Documents] Failed to clean up temp file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload document'
    });
  }
});

/**
 * GET /api/documents
 * List all documents for the authenticated hotel
 * Query params: documentType, tags (comma-separated), limit
 */
router.get('/', requireHotelAuth, async (req, res) => {
  try {
    // Use JWT hotelId for document listing (secure, no API key exposure)
    const hotelId = req.hotel.hotelId;
    const { documentType, tags, limit } = req.query;

    const filters = {};

    if (documentType) {
      filters.documentType = documentType;
    }

    if (tags) {
      filters.tags = tags.split(',').map(t => t.trim());
    }

    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    console.log(`[Documents] Listing documents for hotel ${hotelId} with filters:`, filters);

    const documents = await getDocuments(hotelId, filters);

    // Remove embeddings from response (too large)
    const sanitizedDocuments = documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      documentType: doc.documentType,
      fileSize: doc.fileSize,
      tags: doc.tags,
      description: doc.description,
      structuredData: doc.structuredData,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));

    res.json({
      success: true,
      documents: sanitizedDocuments,
      count: sanitizedDocuments.length
    });
  } catch (error) {
    console.error('[Documents] List error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list documents'
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its vector embeddings
 */
router.delete('/:id', requireHotelAuth, async (req, res) => {
  try {
    // Use JWT hotelId for document deletion (secure, no API key exposure)
    const hotelId = req.hotel.hotelId;
    const documentId = req.params.id;

    console.log(`[Documents] Deleting document ${documentId} for hotel ${hotelId}`);

    // Delete from Firestore (this also deletes vector embeddings)
    await deleteDocument(hotelId, documentId);

    // Note: We could also delete the file from Cloud Storage here,
    // but keeping it for audit trail purposes might be useful

    console.log(`[Documents] Document ${documentId} deleted successfully`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('[Documents] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete document'
    });
  }
});

export default router;
