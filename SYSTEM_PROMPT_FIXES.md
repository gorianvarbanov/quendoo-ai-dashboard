# System Prompt Fixes - Tool Execution Logic

**Date:** 2026-01-06
**Commits:** 10aaa17, ea79d8c
**Backend Revisions:** 00073-27c → 00074-jmb
**Status:** ✅ DEPLOYED AND ACTIVE

---

## Problems Fixed

### Problem 1: Tool Execution Loop
**Symptom:** Claude was calling the same tool (e.g., `get_property_settings`) 8 times repeatedly when asked "дай детайли за стаите" (give room details).

**User Report:** "нещо лупва" (something is looping)

**Root Cause:** System prompt didn't clearly state that each data-retrieval tool returns ALL data in ONE call. Claude thought it needed to keep calling to get more data.

### Problem 2: Unnecessary "Remaining Tasks" Message
**Symptom:** Claude responded with "Няма останали задачи за изпълнение. Вашата заявка беше напълно завършена..." (No remaining tasks. Your request was fully completed...) but didn't show the actual room details.

**User Report:** "не дава резултати и защо започва с изречението че няма други задачи. това мисля че е свързано с мулти степ логиката, може ли да провериш и да предложиш вариант как да го направим по логично"

**Root Cause:** The multi-step execution logic section was confusing Claude into thinking it needed to wait for more steps or confirm task completion.

---

## Solution Implemented

### Fix 1: Anti-Looping Rules (Commit 10aaa17, Revision 00073-27c)

**File:** `backend/mcp-client/src/systemPrompts.js`

**Changes:**

1. **Added Global Anti-Looping Rule (Lines 140-144):**
```javascript
**⚠️ CRITICAL TOOL EXECUTION RULE:**
**NEVER call the same tool multiple times in a single request unless explicitly needed for different parameters**
- Each data-retrieval tool (get_availability, get_bookings, get_property_settings, get_rooms_details) returns ALL available data in ONE call
- DO NOT loop or repeat tool calls thinking you'll get more data
- If you need to send multiple emails or make multiple calls, that's okay - but data tools should only be called ONCE
```

2. **Added Specific Tool Warnings:**

**get_property_settings (Lines 167-169):**
```javascript
- get_property_settings: Gets hotel configuration (rooms list, rates, services, meals, beds, booking modules, payment methods).
  ⚠️ **CRITICAL: Call this tool ONLY ONCE per request** - it returns ALL settings in one call
  ⚠️ DO NOT call this tool multiple times in the same request
```

**get_rooms_details (Lines 172-173):**
```javascript
- get_rooms_details: Returns STATIC room type information (room names, sizes, bed types, amenities, photos).
  ⚠️ **CRITICAL: Call this tool ONLY ONCE per request** - it returns ALL room types in one call
```

**Result:** ✅ Tool looping issue resolved after deployment

---

### Fix 2: Simplified Tool Execution Logic (Commit ea79d8c, Revision 00074-jmb)

**File:** `backend/mcp-client/src/systemPrompts.js`

**Changes:**

1. **Replaced Multi-Tool Execution Section (Lines 61-83):**

**Before (System Prompt v2.1):**
```javascript
=== MULTI-TOOL EXECUTION (CRITICAL) ===
When a user request requires multiple tool calls, you MUST:
1. Think through ALL required tools before execution
2. Call ALL tools in your FIRST response (if possible)
3. Wait for ALL tool results before responding
4. Present the final answer ONLY AFTER all tools have returned results

[... complex multi-step logic that confused Claude ...]
```

**After (System Prompt v2.2):**
```javascript
=== TOOL EXECUTION RULES ===
**CRITICAL: Execute ALL tools needed, then present results in ONE final response**

**Simple Queries (data retrieval only):**
Examples: "дай наличности", "дай детайли за стаите", "покажи резервации"
- Call the tool(s) needed in your FIRST response
- Format and present the results IMMEDIATELY after tool execution
- **NEVER say "няма останали задачи" or mention task completion**
- Just present the data in a clear, formatted way

**Complex Queries (data + action):**
Examples: "намери оферта и изпрати имейл", "провери наличност и обади клиента"
1. Call data-gathering tool first (get_booking_offers, get_availability)
2. Then call action tools (send_quendoo_email, make_call) with the data
3. Present final confirmation

**CRITICAL RULES:**
- ❌ NEVER say "Няма останали задачи за изпълнение"
- ❌ NEVER say "Задачата е завършена" unless user explicitly asked to complete a task
- ❌ NEVER ask "Имате ли друга заявка?" or prompt for next action
- ✅ Just present the results clearly and wait for user's next message
- ✅ After getting tool results, format them nicely and show to user
- ✅ Use Markdown formatting for readability
```

2. **Simplified Tool Calling Guidelines (Lines 124-129):**

**Before:**
```javascript
**Critical Tool Calling Rules:**
- Think through all required tools before execution
- Execute tools in logical order
- Wait for all results before presenting to user
[... verbose multi-step instructions ...]
```

**After:**
```javascript
**Tool Calling Guidelines:**
- Call all necessary tools in your first response
- For simple data queries: call tool → format results → present to user
- For complex tasks with actions: call data tool → call action tool → confirm completion
- NO explanatory text before or between tool calls
- Present results clearly using Markdown formatting
```

3. **Enhanced get_rooms_details Documentation (Lines 178-183):**
```javascript
**After calling this tool, you MUST format the results clearly:**
- List each room type with its name, size, bed configuration
- Include key amenities (балкон, изглед, климатик, etc.)
- If photos are available, include image URLs in Markdown format
- Use numbered list format (1., 2., 3.) for multiple rooms
- Present in Bulgarian with clear, professional formatting
```

4. **Updated OUTPUT REQUIREMENTS (Lines 314-316):**
```javascript
- **After tool execution, immediately present the formatted results**
- **NEVER add phrases like "Няма останали задачи", "Задачата е завършена", "Имате ли друга заявка"**
- Simply present the data and wait for user's next message
```

**Result:** ✅ "Remaining tasks" message eliminated, result formatting improved

---

## Testing Instructions

### Test 1: Tool Looping (Fixed in 00073-27c)
**Query:** "дай детайли за стаите" (give room details)

**Expected Behavior:**
- ✅ Claude calls `get_rooms_details` **ONCE**
- ✅ Claude calls `get_property_settings` **ONCE** (if needed)
- ✅ NO repeated tool calls

**Before Fix:** Called `get_property_settings` 8 times
**After Fix:** Calls each tool only once

---

### Test 2: Result Presentation (Fixed in 00074-jmb)
**Query:** "дай детайли за стаите" (give room details)

**Expected Behavior:**
- ✅ Claude calls tool(s) immediately
- ✅ Claude formats and presents results directly
- ❌ NO message "Няма останали задачи за изпълнение"
- ❌ NO message "Задачата е завършена"
- ✅ Results formatted with room details, sizes, amenities

**Before Fix:** Showed "Няма останали задачи" without actual results
**After Fix:** Shows formatted room details immediately

---

### Test 3: Simple Data Query
**Query:** "дай наличности за февруари" (give availability for February)

**Expected Behavior:**
- ✅ Calls `get_availability` once with date range
- ✅ Shows availability table
- ✅ Shows "View Availability Calendar" button
- ❌ NO task completion messages

---

### Test 4: Complex Query (Data + Action)
**Query:** "намери оферта за 10-12 февруари за 2 възрастни и изпрати имейл на test@example.com" (find offer for Feb 10-12 for 2 adults and send email)

**Expected Behavior:**
1. ✅ Calls `get_booking_offers` first
2. ✅ Then calls `send_quendoo_email` with offer data
3. ✅ Confirms email sent
4. ❌ NO unnecessary task completion messages

---

## Version History

| Version | Date | Commit | Revision | Changes |
|---------|------|--------|----------|---------|
| 2.0 | 2026-01-05 | Previous | 00072-dl7 | Initial system prompt |
| 2.1 | 2026-01-06 | 10aaa17 | 00073-27c | Added anti-looping rules |
| 2.2 | 2026-01-06 | ea79d8c | 00074-jmb | Simplified execution logic, removed task messages |

---

## Files Modified

### backend/mcp-client/src/systemPrompts.js

**Lines Changed:**
- 61-83: Replaced MULTI-TOOL EXECUTION with TOOL EXECUTION RULES
- 124-129: Simplified Tool Calling Guidelines
- 140-144: Added global anti-looping rule
- 167-169: Added get_property_settings warning
- 172-173: Added get_rooms_details warning
- 178-183: Enhanced get_rooms_details formatting requirements
- 314-316: Updated OUTPUT REQUIREMENTS

**Total Changes:** ~80 lines modified/added

---

## Deployment Status

**Backend:**
- ✅ Deployed as revision **quendoo-backend-00074-jmb**
- ✅ Serving 100% of traffic
- ✅ Service URL: https://quendoo-backend-222402522800.us-central1.run.app

**Git:**
- ✅ Committed to main branch
- ✅ Pushed to https://github.com/gorianvarbanov/quendoo-ai-dashboard
- ✅ Commit: ea79d8c

---

## Known Issues

### Issue: Stream Processing Failed (HTTP 500)
**Status:** ⚠️ NOT YET RESOLVED

**Symptom:** When asking "дай наличности за месец април" (give availability for April), backend returns "Stream processing failed" error.

**Diagnosis:**
- Backend logs show HTTP 500 errors from MCP server
- SSE connection failures
- MCP server logs show HTTP 500 responses
- Likely caused by invalid date range (April 2026 too far in future) or Quendoo API errors

**Workaround:** Use closer date ranges (e.g., February instead of April)

**Next Steps:** Investigate MCP server error handling and Quendoo API date range limits

---

## Summary

✅ **Tool looping issue completely fixed**
✅ **Unnecessary task completion messages eliminated**
✅ **Result formatting improved**
✅ **Tool execution logic simplified and clarified**
✅ **All changes deployed to production**

System prompt is now more intuitive and produces cleaner, more direct responses without unnecessary meta-commentary about task completion.

---

_Generated: 2026-01-06_
