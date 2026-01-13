"""
Test query_excel_data functionality directly
"""
import asyncio
import sys
import os

# Add app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from services.document_service import query_excel_structured


async def test_query():
    """Test various Excel queries"""

    hotel_id = "hotel_9ce94bc37976"

    print("=" * 80)
    print("TEST 1: Highest reservation numbers")
    print("=" * 80)

    result = await query_excel_structured(
        hotel_id=hotel_id,
        query="най-високи номера на резервации",
        limit=5
    )

    print(f"Success: {result.get('success')}")
    if result.get('success'):
        print(f"Results Count: {result.get('resultsCount')}")
        print(f"Column: {result.get('column')}")
        print(f"Summary: {result.get('summary')}")
        print(f"\nTop 5 Results:")
        for i, res in enumerate(result.get('results', [])[:5], 1):
            print(f"  {i}. {res.get('matchedValue')} - {res.get('fileName')}")
    else:
        print(f"Error: {result.get('error')}")

    print("\n" + "=" * 80)
    print("TEST 2: Lowest reservation numbers")
    print("=" * 80)

    result = await query_excel_structured(
        hotel_id=hotel_id,
        query="най-ниски 3 номера",
        limit=3
    )

    print(f"Success: {result.get('success')}")
    if result.get('success'):
        print(f"Results Count: {result.get('resultsCount')}")
        print(f"\nBottom 3 Results:")
        for i, res in enumerate(result.get('results', []), 1):
            print(f"  {i}. {res.get('matchedValue')}")
    else:
        print(f"Error: {result.get('error')}")

    print("\n" + "=" * 80)
    print("TEST 3: Specific reservation (442231)")
    print("=" * 80)

    result = await query_excel_structured(
        hotel_id=hotel_id,
        query="резервация 442231",
        limit=1
    )

    print(f"Success: {result.get('success')}")
    if result.get('success'):
        print(f"Results Count: {result.get('resultsCount')}")
        if result.get('results'):
            res = result['results'][0]
            print(f"\nMatched: {res.get('matchedValue')}")
            print(f"File: {res.get('fileName')}")
            print(f"Data fields: {list(res.get('data', {}).keys())[:10]}...")
    else:
        print(f"Error: {result.get('error')}")

    print("\n" + "=" * 80)
    print("TEST 4: Check if structuredData exists")
    print("=" * 80)

    # Direct Firestore check
    from google.cloud import firestore
    db = firestore.Client()

    docs_ref = db.collection(hotel_id).document("documents").collection("hotel_documents")
    docs_snapshot = docs_ref.stream()

    excel_count = 0
    structured_count = 0

    for doc in docs_snapshot:
        data = doc.to_dict()
        mime_type = data.get("mimeType", "")
        if "spreadsheet" in mime_type or "excel" in mime_type:
            excel_count += 1
            structured_data = data.get("structuredData", {})
            if structured_data.get("excel"):
                structured_count += 1
                excel_data = structured_data["excel"]
                print(f"\nFile: {data.get('fileName')}")
                print(f"  Headers: {len(excel_data.get('headers', []))} columns")
                print(f"  Rows: {len(excel_data.get('rows', []))} records")
                print(f"  First column: {excel_data.get('headers', ['N/A'])[0]}")

    print(f"\nTotal Excel files: {excel_count}")
    print(f"With structuredData: {structured_count}")


if __name__ == "__main__":
    asyncio.run(test_query())
