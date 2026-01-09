"""
Document RAG Service - Vector search and document management

Handles:
- Firestore document queries
- Vector embeddings generation
- Semantic search with cosine similarity
"""

from typing import Dict, Any, List, Optional
import os
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud import aiplatform
from vertexai.language_models import TextEmbeddingModel
import base64
import json

# Initialize Firebase Admin (if not already initialized)
try:
    firebase_admin.get_app()
except ValueError:
    # App not initialized, initialize it
    # In Cloud Run, Application Default Credentials are used
    firebase_admin.initialize_app()

# Initialize Vertex AI
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "quendoo-ai-dashboard")
LOCATION = "us-central1"
aiplatform.init(project=PROJECT_ID, location=LOCATION)

# Firestore client
db = firestore.client()

# Embedding model
EMBEDDING_MODEL = "text-embedding-004"


def get_hotel_collection(hotel_id: str):
    """
    Get Firestore collection reference for a specific hotel using hotel ID
    Uses namespace isolation: {hotel_id}/documents/hotel_documents

    Args:
        hotel_id: Hotel ID from JWT token (e.g., "hotel_c01234567890")

    Returns:
        Firestore collection reference
    """
    if not hotel_id:
        raise ValueError("Hotel ID is required for document operations")

    return db.collection(f"{hotel_id}").document("documents").collection("hotel_documents")


async def generate_embedding(text: str) -> List[float]:
    """
    Generate 768-dimensional embedding vector using Vertex AI

    Args:
        text: Text to embed

    Returns:
        768-dimensional embedding vector
    """
    try:
        model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
        embeddings = model.get_embeddings([text])

        if embeddings and len(embeddings) > 0:
            return embeddings[0].values
        else:
            raise ValueError("Failed to generate embedding")

    except Exception as e:
        print(f"[DocumentService] Error generating embedding: {e}")
        raise


def calculate_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors

    Args:
        vec1: First vector
        vec2: Second vector

    Returns:
        Similarity score (-1 to 1)
    """
    if len(vec1) != len(vec2):
        raise ValueError("Vectors must have the same dimension")

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot_product / (norm1 * norm2)


async def search_hotel_documents(
    hotel_id: str,
    query: str,
    document_types: Optional[List[str]] = None,
    top_k: int = 3
) -> Dict[str, Any]:
    """
    Search hotel documents using semantic vector search

    Args:
        hotel_id: Hotel ID from JWT token (e.g., "hotel_c01234567890")
        query: Natural language search query
        document_types: Optional filter by document types
        top_k: Number of results to return (1-10)

    Returns:
        Search results with relevant document excerpts
    """
    try:
        print(f"[DocumentService] Searching documents for hotel: {hotel_id}")
        print(f"[DocumentService] Query: {query}, Types: {document_types}, TopK: {top_k}")

        if not query or not isinstance(query, str):
            return {
                "success": False,
                "error": "Query parameter is required and must be a string"
            }

        if not hotel_id:
            return {
                "success": False,
                "error": "Hotel ID is required for document search"
            }

        # Limit top_k between 1 and 10
        top_k = max(1, min(top_k, 10))

        # Generate query embedding
        print(f"[DocumentService] Generating query embedding...")
        query_embedding = await generate_embedding(query)

        # Get hotel document collection using hotel ID
        collection = get_hotel_collection(hotel_id)

        # Build query with optional document type filter
        query_ref = collection
        if document_types and len(document_types) > 0:
            query_ref = query_ref.where("documentType", "in", document_types)

        # Get all documents (we'll calculate similarity manually)
        print(f"[DocumentService] Fetching documents from Firestore...")
        docs_snapshot = query_ref.stream()

        results = []

        for doc in docs_snapshot:
            data = doc.to_dict()

            # Decode embeddings from base64
            if not data.get("embeddingsEncoded"):
                continue

            try:
                decoded_string = base64.b64decode(data["embeddingsEncoded"]).decode("utf-8")
                embeddings = json.loads(decoded_string)
            except Exception as e:
                print(f"[DocumentService] Failed to decode embeddings for doc {doc.id}: {e}")
                continue

            # Calculate similarity for each chunk
            if embeddings and isinstance(embeddings, list):
                for chunk_index, embedding in enumerate(embeddings):
                    if not isinstance(embedding, list):
                        continue

                    similarity = calculate_cosine_similarity(query_embedding, embedding)

                    text_chunks = data.get("textChunks", [])
                    text_chunk = text_chunks[chunk_index] if chunk_index < len(text_chunks) else ""

                    results.append({
                        "documentId": doc.id,
                        "fileName": data.get("fileName", ""),
                        "documentType": data.get("documentType", ""),
                        "chunkIndex": chunk_index,
                        "textChunk": text_chunk,
                        "similarity": similarity,
                        "structuredData": data.get("structuredData", {}),
                        "tags": data.get("tags", [])
                    })

        # Sort by similarity (highest first) and take top K
        results.sort(key=lambda x: x["similarity"], reverse=True)
        top_results = results[:top_k]

        # Format results for Claude
        formatted_results = []
        for i, result in enumerate(top_results):
            excerpt = result["textChunk"][:500]
            if len(result["textChunk"]) > 500:
                excerpt += "..."

            formatted_results.append({
                "rank": i + 1,
                "fileName": result["fileName"],
                "documentType": result["documentType"],
                "relevanceScore": round(result["similarity"], 2),
                "excerpt": excerpt,
                "fullText": result["textChunk"],
                "structuredData": result["structuredData"],
                "tags": result["tags"]
            })

        print(f"[DocumentService] Found {len(formatted_results)} relevant documents")

        # Generate summary
        if len(formatted_results) == 0:
            summary = "No relevant documents found for this query."
        else:
            document_types_found = list(set(r["documentType"] for r in formatted_results))
            file_names_found = list(set(r["fileName"] for r in formatted_results))
            summary = f"Found {len(formatted_results)} relevant excerpt(s) from {len(file_names_found)} document(s). "
            summary += f"Document types: {', '.join(document_types_found)}. "
            summary += f"Top result: \"{formatted_results[0]['fileName']}\" with {round(formatted_results[0]['relevanceScore'] * 100)}% relevance."

        return {
            "success": True,
            "query": query,
            "resultsCount": len(formatted_results),
            "results": formatted_results,
            "summary": summary
        }

    except Exception as e:
        print(f"[DocumentService] Error searching documents: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def list_hotel_documents(
    hotel_id: str,
    document_types: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    List all hotel documents with metadata

    Args:
        hotel_id: Hotel ID from JWT token (e.g., "hotel_c01234567890")
        document_types: Optional filter by document types

    Returns:
        List of documents with names, types, descriptions, sizes
    """
    try:
        print(f"[DocumentService] Listing documents for hotel: {hotel_id}")
        print(f"[DocumentService] Document types filter: {document_types}")

        if not hotel_id:
            return {
                "success": False,
                "error": "Hotel ID is required for document listing"
            }

        # Get hotel document collection using hotel ID
        collection = get_hotel_collection(hotel_id)

        # Build query with optional document type filter
        query_ref = collection.order_by("createdAt", direction=firestore.Query.DESCENDING)

        if document_types and len(document_types) > 0:
            query_ref = collection.where("documentType", "in", document_types).order_by("createdAt", direction=firestore.Query.DESCENDING)

        # Get documents
        docs_snapshot = query_ref.stream()

        documents = []
        for doc in docs_snapshot:
            data = doc.to_dict()

            # Format upload date
            upload_date = "N/A"
            if data.get("createdAt"):
                try:
                    upload_date = data["createdAt"].strftime("%Y-%m-%d")
                except:
                    upload_date = "N/A"

            # Format file size
            file_size_formatted = "N/A"
            if data.get("fileSize"):
                size_bytes = data["fileSize"]
                size_mb = size_bytes / (1024 * 1024)
                if size_mb >= 1:
                    file_size_formatted = f"{size_mb:.2f} MB"
                else:
                    file_size_formatted = f"{(size_bytes / 1024):.2f} KB"

            documents.append({
                "fileName": data.get("fileName", ""),
                "documentType": data.get("documentType", ""),
                "description": data.get("description", ""),
                "tags": data.get("tags", []),
                "uploadedAt": upload_date,
                "fileSize": file_size_formatted
            })

        print(f"[DocumentService] Found {len(documents)} documents")

        return {
            "success": True,
            "count": len(documents),
            "documents": documents
        }

    except Exception as e:
        print(f"[DocumentService] Error listing documents: {e}")
        return {
            "success": False,
            "error": str(e)
        }
