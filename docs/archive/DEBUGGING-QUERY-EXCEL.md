# Debugging query_excel_data Issue

## 🔍 Problem

User query: **"покажи ми най-високи номера на резервации"**

Claude response: "Excel файлът export-20260110-163315.xlsx изглежда празен или няма данни..."

But `inspect-new-upload.js` shows:
- ✅ File exists
- ✅ structuredData exists
- ✅ 152 records × 31 fields

## 📊 What We Know

1. **Tool is deployed:** mcp-quendoo-chatbot-00029-4wf
2. **structuredData exists:** Verified in Firestore
3. **Claude used 4 tools:** Not sure which ones

## 🤔 Possible Issues

### Issue 1: Claude used wrong tool
**Hypothesis:** Claude called `search_hotel_documents` instead of `query_excel_data`

**Why:** System prompt may not be clear enough, or Claude chose wrong tool

**Test:** Check Cloud Run logs for which tool was called

**Fix:** Make system prompt more explicit

---

### Issue 2: query_excel_data returned empty results
**Hypothesis:** Query parsing failed, no results matched

**Possible reasons:**
- Detection logic didn't match "най-високи"
- Column detection failed
- Sorting failed
- No numeric values found

**Test:** Add debug logging and check Cloud Run logs

**Fix:** Improve query parsing

---

### Issue 3: structuredData format mismatch
**Hypothesis:** Excel data is in unexpected format

**Possible reasons:**
- Headers are different than expected
- Data is nested differently
- Rows are empty arrays

**Test:** Print actual structuredData structure in logs

**Fix:** Handle different formats

---

## 🔧 Debugging Steps

### Step 1: Check which tool Claude called

Look at Cloud Run logs for `mcp-quendoo-chatbot`:
```
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mcp-quendoo-chatbot" --limit=50 --format=json
```

Search for:
- `[ExcelQuery]` - means query_excel_data was called
- `[DocumentService]` - means search_hotel_documents was called

### Step 2: Check tool execution logs

If query_excel_data was called, check:
- Did it find Excel files?
- Did it parse query intent correctly?
- Did it find the column?
- How many rows matched?

### Step 3: Test query parsing manually

Test the query detection logic:
```python
query = "покажи ми най-високи номера на резервации"
query_lower = query.lower()

is_highest = any(word in query_lower for word in [
    "най-високи", "най-висок", "highest", "maximum", "max", "максимал", "топ"
])

print(f"Is highest: {is_highest}")  # Should be True
```

### Step 4: Check actual structuredData format

Run this in backend:
```javascript
const doc = await db.collection('hotel_9ce94bc37976')
  .doc('documents')
  .collection('hotel_documents')
  .where('fileName', '==', 'export-20260110-163315.xlsx')
  .get();

const data = doc.docs[0].data();
const excel = data.structuredData?.excel;

console.log('Headers:', excel?.headers);
console.log('First row:', excel?.rows?.[0]);
console.log('Total rows:', excel?.rows?.length);
```

---

## 🚀 Quick Fixes to Try

### Fix 1: Add comprehensive logging

Add to `query_excel_structured()`:

```python
print(f"[ExcelQuery] ===== QUERY START =====")
print(f"[ExcelQuery] Query: '{query}'")
print(f"[ExcelQuery] Hotel ID: {hotel_id}")
print(f"[ExcelQuery] File name filter: {file_name}")
print(f"[ExcelQuery] Limit: {limit}")

# After parsing
print(f"[ExcelQuery] is_highest: {is_highest}")
print(f"[ExcelQuery] is_lowest: {is_lowest}")
print(f"[ExcelQuery] is_specific_value: {is_specific_value}")
print(f"[ExcelQuery] numbers_in_query: {numbers_in_query}")

# After finding column
print(f"[ExcelQuery] Target columns: {target_columns}")
print(f"[ExcelQuery] Matched column: {matched_column}")
print(f"[ExcelQuery] Column index: {col_index}")

# After processing
print(f"[ExcelQuery] Total rows collected: {len(all_results)}")
print(f"[ExcelQuery] After filtering: {len(all_results)}")
print(f"[ExcelQuery] After limiting: {len(formatted_results)}")
print(f"[ExcelQuery] ===== QUERY END =====")
```

### Fix 2: Improve system prompt

Make it MORE explicit in system prompt:

```javascript
**CRITICAL: Excel Queries**

When user asks about NUMBERS or SPECIFIC VALUES in Excel:
✅ ALWAYS use query_excel_data
❌ NEVER use search_hotel_documents

Examples that MUST use query_excel_data:
- "най-високи номера" → query_excel_data
- "най-ниски цени" → query_excel_data
- "резервация 442231" → query_excel_data
- "номера над 400000" → query_excel_data
- "покажи топ 10" → query_excel_data

Only use search_hotel_documents for TEXT questions:
- "какви са условията за отказ"
- "политика за cancellation"
```

### Fix 3: Handle empty results gracefully

```python
if not formatted_results:
    # Check why no results
    if not all_results:
        error_msg = "No rows found in Excel file. "
        if not excel_docs:
            error_msg += "No Excel files uploaded."
        else:
            error_msg += f"Excel file has {len(excel_docs)} sheets but no data rows."
    else:
        error_msg = f"Query matched {len(all_results)} rows but none passed filters."

    return {
        "success": False,
        "error": error_msg,
        "debug": {
            "excelFilesFound": len(excel_docs),
            "totalRowsInFiles": sum(len(data.get('structuredData', {}).get('excel', {}).get('rows', [])) for _, data in excel_docs),
            "rowsCollected": len(all_results),
            "query": query
        }
    }
```

---

## 💡 Most Likely Issue

Based on the error message "файлът изглежда празен", I suspect:

**Claude called `list_hotel_documents` or `search_hotel_documents` instead of `query_excel_data`**

Why? The system prompt might not be explicit enough, or Claude saw "показ ми" and thought it's a listing operation.

**Solution:**
1. Check logs to confirm
2. Update system prompt to be MORE explicit
3. Add examples directly in tool description

---

## ✅ Action Plan

1. **Check Cloud Run logs** - see which tool was called
2. **Add debug logging** - if query_excel_data was called but failed
3. **Update system prompt** - make tool selection more explicit
4. **Test again** - with clearer query like "query_excel_data най-високи номера"

---

Should I:
- A) Add comprehensive debug logging and redeploy?
- B) Check Cloud Run logs first?
- C) Update system prompt to be more explicit?
- D) All of the above?
