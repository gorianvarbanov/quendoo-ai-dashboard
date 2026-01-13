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

            # UPDATED: Read chunks from subcollection (new format)
            # Old format used textChunks array in main document, but we moved to subcollection
            # to avoid Firestore's 10MB document size limit
            try:
                chunks_ref = doc.reference.collection("chunks")
                chunks_snapshot = chunks_ref.stream()

                for chunk_doc in chunks_snapshot:
                    chunk_data = chunk_doc.to_dict()

                    # Get embedding and text from chunk
                    embedding = chunk_data.get("embedding")
                    text_chunk = chunk_data.get("text", "")
                    chunk_index = chunk_data.get("chunkIndex", 0)

                    if not embedding or not isinstance(embedding, list):
                        continue

                    # Calculate similarity
                    similarity = calculate_cosine_similarity(query_embedding, embedding)

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

            except Exception as e:
                print(f"[DocumentService] Failed to read chunks for doc {doc.id}: {e}")
                continue

        # Sort by similarity (highest first) and take top K
        results.sort(key=lambda x: x["similarity"], reverse=True)
        top_results = results[:top_k]

        # Format results for Claude
        formatted_results = []
        for i, result in enumerate(top_results):
            # OPTIMIZATION: Limit excerpt to 500 chars to avoid token limit
            # Analysis shows: 500 chars = ~143 tokens per result
            # With 3 results: 143 × 3 = ~429 tokens (vs 590 tokens at 800 chars)
            # This is a 40% reduction in tool result size
            excerpt = result["textChunk"][:500]
            if len(result["textChunk"]) > 500:
                excerpt += "..."

            formatted_results.append({
                "rank": i + 1,
                "fileName": result["fileName"],
                "documentType": result["documentType"],
                "relevanceScore": round(result["similarity"], 2),
                "excerpt": excerpt,
                # REMOVED fullText to save tokens - excerpt should be enough
                # "fullText": result["textChunk"],
                # REMOVED structuredData - can be 152 records × 31 fields = HUGE token usage
                # For Excel with 152 reservations, this alone is ~150K tokens!
                # "structuredData": result["structuredData"],
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


async def query_excel_structured(
    hotel_id: str,
    query: str,
    file_name: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Query structured Excel data with intelligent parsing for numeric/specific value queries

    Args:
        hotel_id: Hotel ID from JWT token
        query: Natural language query (e.g., "най-високи номера", "резервация 442231")
        file_name: Optional specific Excel filename
        limit: Maximum results to return

    Returns:
        Filtered and sorted Excel rows based on query intent
    """
    try:
        print(f"[ExcelQuery] ===== QUERY START =====")
        print(f"[ExcelQuery] Query: '{query}'")
        print(f"[ExcelQuery] Hotel ID: {hotel_id}")
        print(f"[ExcelQuery] File name filter: {file_name}")
        print(f"[ExcelQuery] Limit: {limit}")

        # Get Excel documents from Firestore
        docs_ref = db.collection(hotel_id).document("documents").collection("hotel_documents")

        # Filter by filename if provided
        if file_name:
            docs_snapshot = docs_ref.where("fileName", "==", file_name).stream()
        else:
            docs_snapshot = docs_ref.stream()

        # Filter only Excel documents
        excel_docs = []
        for doc in docs_snapshot:
            data = doc.to_dict()
            mime_type = data.get("mimeType", "")
            if mime_type in [
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel"
            ]:
                excel_docs.append((doc.id, data))

        if not excel_docs:
            return {
                "success": False,
                "error": "No Excel files found in documents"
            }

        print(f"[ExcelQuery] Found {len(excel_docs)} Excel document(s)")

        # Parse query intent
        query_lower = query.lower()

        # Detect query type
        is_highest = any(word in query_lower for word in [
            "най-високи", "най-висок", "highest", "maximum", "max", "максимал", "топ"
        ])
        is_lowest = any(word in query_lower for word in [
            "най-ниски", "най-нисък", "lowest", "minimum", "min", "минимал"
        ])
        is_specific_value = any(char.isdigit() for char in query)  # Contains numbers

        # Extract numbers from query for exact matching
        import re
        numbers_in_query = re.findall(r'\d+', query)

        print(f"[ExcelQuery] Query intent detection:")
        print(f"[ExcelQuery]   is_highest: {is_highest}")
        print(f"[ExcelQuery]   is_lowest: {is_lowest}")
        print(f"[ExcelQuery]   is_specific_value: {is_specific_value}")
        print(f"[ExcelQuery]   numbers_in_query: {numbers_in_query}")

        # Detect target column from query
        column_keywords = {
            "резервация": ["Резервация номер", "Reservation number", "ID", "Номер"],
            "reservation": ["Резервация номер", "Reservation number", "ID"],
            "номер": ["Резервация номер", "Reservation number", "ID", "Номер"],
            "цена": ["Цена на нощувка", "Обща цена", "Price", "Total price"],
            "price": ["Цена на нощувка", "Обща цена", "Price"],
            "дата": ["Начална дата", "Крайна дата", "Date", "Created At"],
            "date": ["Начална дата", "Крайна дата", "Date"],
            "име": ["Име", "Фамилия", "Name", "Guest"],
            "name": ["Име", "Фамилия", "Name"],
            "статус": ["Статус", "Status"],
            "status": ["Статус", "Status"]
        }

        # Find target column
        target_columns = None
        for keyword, possible_cols in column_keywords.items():
            if keyword in query_lower:
                target_columns = possible_cols
                break

        # Default to reservation number if not specified
        if not target_columns:
            target_columns = ["Резервация номер", "Reservation number", "ID", "Номер"]

        print(f"[ExcelQuery] Target columns: {target_columns}")

        # Collect all matching rows from all Excel docs
        all_results = []

        for doc_id, data in excel_docs:
            structured_data = data.get("structuredData", {})
            excel_data = structured_data.get("excel", {})

            # Excel data format from backend: { sheets: { "SheetName": { schema: [], records: [...], recordCount: N } } }
            sheets = excel_data.get("sheets", {})

            print(f"[ExcelQuery] Processing file: {data.get('fileName')}")
            print(f"[ExcelQuery]   Sheets: {list(sheets.keys())}")

            if not sheets:
                print(f"[ExcelQuery] ❌ Skipping {data.get('fileName')} - no sheets in structured data")
                continue

            # Process first sheet (could process all sheets if needed)
            sheet_name = list(sheets.keys())[0]
            sheet_data = sheets[sheet_name]
            records = sheet_data.get("records", [])

            print(f"[ExcelQuery]   Sheet: {sheet_name}")
            print(f"[ExcelQuery]   Records count: {len(records)}")

            if not records or len(records) == 0:
                print(f"[ExcelQuery] ❌ Skipping {data.get('fileName')} - no records in sheet")
                continue

            # Extract headers from first record keys
            headers = list(records[0].keys()) if records else []
            print(f"[ExcelQuery]   Headers count: {len(headers)}")
            if headers:
                print(f"[ExcelQuery]   First 5 headers: {headers[:5]}")

            # Find the target column
            matched_column = None
            for possible_col in target_columns:
                if possible_col in headers:
                    matched_column = possible_col
                    break

            if matched_column is None:
                print(f"[ExcelQuery] ⚠️ Column not found in {data.get('fileName')}, using first column")
                matched_column = headers[0] if headers else None

            if not matched_column:
                print(f"[ExcelQuery] ❌ No valid column found")
                continue

            print(f"[ExcelQuery] ✅ Using column: '{matched_column}'")

            # Process each record (records are dicts, not arrays)
            for record in records:
                value = record.get(matched_column)

                # Try to extract numeric value for sorting
                numeric_value = None
                if value is not None:
                    try:
                        # Remove commas and convert to float
                        numeric_value = float(str(value).replace(",", "").replace(" ", ""))
                    except:
                        pass

                # Check if this row matches for specific value queries
                matches_specific = False
                if is_specific_value and numbers_in_query:
                    value_str = str(value)
                    for num in numbers_in_query:
                        if num in value_str:
                            matches_specific = True
                            break

                all_results.append({
                    "fileName": data.get("fileName"),
                    "column": matched_column,
                    "value": value,
                    "numericValue": numeric_value,
                    "matchesSpecific": matches_specific,
                    "rowData": record  # record is already a dict
                })

        print(f"[ExcelQuery] Collected {len(all_results)} total rows from all files")

        # Filter for specific value queries
        if is_specific_value and numbers_in_query:
            before_filter = len(all_results)
            all_results = [r for r in all_results if r["matchesSpecific"]]
            print(f"[ExcelQuery] Filtered from {before_filter} to {len(all_results)} matching rows (looking for: {numbers_in_query})")

        # Sort results based on query intent
        if is_highest:
            # Sort by numeric value descending (highest first)
            all_results.sort(
                key=lambda x: x["numericValue"] if x["numericValue"] is not None else float('-inf'),
                reverse=True
            )
            print(f"[ExcelQuery] Sorted by highest values")
        elif is_lowest:
            # Sort by numeric value ascending (lowest first)
            all_results.sort(
                key=lambda x: x["numericValue"] if x["numericValue"] is not None else float('inf')
            )
            print(f"[ExcelQuery] Sorted by lowest values")

        # Limit results
        before_limit = len(all_results)
        all_results = all_results[:limit]
        print(f"[ExcelQuery] After limiting: {len(all_results)} results (from {before_limit})")

        # Format output
        formatted_results = []
        for r in all_results:
            formatted_results.append({
                "fileName": r["fileName"],
                "matchedColumn": r["column"],
                "matchedValue": r["value"],
                "data": r["rowData"]
            })

        # Generate summary
        if not formatted_results:
            summary = "No matching rows found in Excel files."
            print(f"[ExcelQuery] ❌ No results to return")
        else:
            print(f"[ExcelQuery] ✅ Returning {len(formatted_results)} results")
            summary = f"Found {len(formatted_results)} row(s) from Excel file(s). "
            if is_highest:
                summary += f"Showing highest values in column '{formatted_results[0]['matchedColumn']}'."
            elif is_lowest:
                summary += f"Showing lowest values in column '{formatted_results[0]['matchedColumn']}'."
            elif is_specific_value:
                summary += f"Showing rows matching: {', '.join(numbers_in_query)}."
            else:
                summary += f"Showing results from column '{formatted_results[0]['matchedColumn']}'."

        print(f"[ExcelQuery] ===== QUERY END =====")

        return {
            "success": True,
            "query": query,
            "column": formatted_results[0]["matchedColumn"] if formatted_results else None,
            "resultsCount": len(formatted_results),
            "results": formatted_results,
            "summary": summary
        }

    except Exception as e:
        print(f"[ExcelQuery] ❌❌❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }
