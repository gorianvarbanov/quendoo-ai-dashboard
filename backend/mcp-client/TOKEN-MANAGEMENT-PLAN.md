# Token Management Strategy - Implementation Plan

## 📊 Анализ на проблема

### Констатации от симулацията:
- **Baseline (system + tools):** 5,059 tokens (fixed)
- **Average turn size:** 744 tokens (4 messages)
- **6 messages history:** ~6,175 tokens (3% от 200K лимита)
- **12 messages history:** ~7,291 tokens (3.6% от лимита)
- **20 messages history:** ~8,779 tokens (4.4% от лимита)

### ⚠️ КРИТИЧНА НАХОДКА:

**История с 6-20 съобщения НЕ МОЖЕ да достигне 206K tokens!**

Това означава, че проблемът е в:

1. **Multiple tool calls в един turn** - Claude прави 5-10 tool calls наведнъж
2. **Large tool results не са оптимизирани** - някои tools връщат огромни данни
3. **Repeated tool calls** - Claude прави същия tool call многократно
4. **Accumulation in single request** - всички tool results се трупат в ЕДИН request

---

## 🔍 Root Causes

### 1. Multi-Tool Execution Loop
```javascript
// В quendooClaudeIntegration.js (line 711-815)
const maxLoops = 10;
while (loopCount < maxLoops) {
  const response = await this.anthropic.messages.create(requestParams);
  // Ако Claude иска tools, добавя tool_results в history
  // След това прави НОВ request с НАРАСТВАЩА история
}
```

**Проблем:** Всеки loop добавя tool results към историята ПРЕДИ следващия request.

При 5 tool calls × 590 tokens/result = **2,950 tokens** добавени към историята!

### 2. Tool Result Size
- Document search: **590 tokens** (3 excerpts × 800 chars)
- Make call transcript: **442 tokens**
- List documents: **411 tokens**

**Проблем:** При множество searches (напр. Claude търси 3-4 пъти), tool results се натрупват.

### 3. No Result Cleanup
След като tool result се използва от Claude, той ОСТАВА в историята завинаги.

**Проблем:** Старите tool results не се изчистват, дори да са ирелевантни.

---

## ✨ РЕШЕНИЯ

### Solution 1: **Smart Truncation** (RECOMMENDED) ⭐

Премахвай tool_result съдържание от стари съобщения, но ПАЗИ структурата за контекст.

#### Implementation:

```javascript
// В quendooClaudeIntegration.js
function smartTruncateHistory(history, keepLastNTurns = 3) {
  const keepLastNMessages = keepLastNTurns * 4; // 4 messages per turn

  if (history.length <= keepLastNMessages) {
    return history; // No truncation needed
  }

  const truncated = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const isRecent = i >= history.length - keepLastNMessages;

    if (isRecent) {
      // Keep recent messages fully
      truncated.push(msg);
    } else {
      // Truncate old tool results
      if (msg.role === 'user' && msg.content.some(c => c.type === 'tool_result')) {
        truncated.push({
          role: 'user',
          content: msg.content.map(c => {
            if (c.type === 'tool_result') {
              return {
                type: 'tool_result',
                tool_use_id: c.tool_use_id,
                content: '[Result truncated to save tokens]'
              };
            }
            return c;
          })
        });
      } else if (msg.role === 'assistant' && msg.content.some(c => c.type === 'tool_use')) {
        // Keep tool_use structure but not parameters
        truncated.push({
          role: 'assistant',
          content: msg.content.map(c => {
            if (c.type === 'tool_use') {
              return {
                type: 'tool_use',
                id: c.id,
                name: c.name,
                input: {} // Remove large input parameters
              };
            }
            return c; // Keep text blocks
          })
        });
      } else {
        // Keep user/assistant text messages
        truncated.push(msg);
      }
    }
  }

  return truncated;
}

// Apply before each request:
history = smartTruncateHistory(history, 3); // Keep last 3 turns fully
```

**Очаквани резултати:**
- Старите tool results: 590 tokens → **10 tokens** (~98% намаление)
- История от 20 messages → **~6,000 tokens** вместо ~18,000 tokens
- Margin за сложни операции: **~194K tokens** налични

---

### Solution 2: **Reduce Tool Result Size** (QUICK WIN) ⚡

Намали размера на индивидуални tool results.

#### Implementation:

**A) Document Search - намали excerpt size**
```javascript
// В documentTools.js и document_service.py
excerpt: result.textChunk.substring(0, 500) // Вместо 800
```

**B) Document Search - намали брой results**
```javascript
// В documentTools.js
const topK = Math.min(Math.max(params.topK || 2, 1), 5); // Вместо 3 default, 10 max
```

**C) Make Call - limit transcript**
```python
# В quendoo/tools.py
transcript: call_result.transcript[:500] if call_result.transcript else "" // Limit to 500 chars
```

**Очаквани резултати:**
- Document search: 590 → **~350 tokens** (40% намаление)
- Make call: 442 → **~250 tokens** (43% намаление)
- При 3 turns × 350 tokens = **1,050 tokens** history вместо 2,232 tokens

---

### Solution 3: **Rate Limiting Tool Calls** (PREVENTION) 🛡️

Ограничи броя tool calls в един turn, за да предотвратиш token explosion.

#### Implementation:

```javascript
// В quendooClaudeIntegration.js (line 732-815)
const MAX_TOOLS_PER_TURN = 3; // Limit to 3 tool calls per turn

if (response.stop_reason === 'tool_use') {
  const toolBlocks = response.content.filter(b => b.type === 'tool_use');

  if (toolBlocks.length > MAX_TOOLS_PER_TURN) {
    console.warn(`[Quendoo] Too many tool calls (${toolBlocks.length}), limiting to ${MAX_TOOLS_PER_TURN}`);

    // Execute only first N tools
    const limitedBlocks = toolBlocks.slice(0, MAX_TOOLS_PER_TURN);

    // Return partial error for remaining tools
    const remainingTools = toolBlocks.slice(MAX_TOOLS_PER_TURN);
    for (const block of remainingTools) {
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify({
          error: 'Too many tool calls in one turn. Please try again in next message.'
        }),
        is_error: true
      });
    }
  }
}
```

**Очаквани резултати:**
- Максимум 3 tool calls × 590 tokens = **1,770 tokens** per turn
- Предотвратява token explosion от 10+ tool calls

---

### Solution 4: **Token Usage Monitoring** (VISIBILITY) 📊

Track actual token usage from Claude API response.

#### Implementation:

```javascript
// В quendooClaudeIntegration.js (line 720)
const response = await this.anthropic.messages.create(requestParams);

// Log actual token usage from API
if (response.usage) {
  console.log(`[Quendoo] Actual token usage:`,
    `input=${response.usage.input_tokens}`,
    `output=${response.usage.output_tokens}`,
    `total=${response.usage.input_tokens + response.usage.output_tokens}`
  );

  // Alert if approaching limit
  if (response.usage.input_tokens > 180000) {
    console.error(`⚠️ [Quendoo] TOKEN LIMIT WARNING: ${response.usage.input_tokens} / 200000 tokens (${(response.usage.input_tokens / 200000 * 100).toFixed(1)}%)`);
  }
}
```

**Очаквани резултати:**
- Real-time visibility в token usage
- Early warning при приближаване към лимита
- Data за по-нататъшна оптимизация

---

### Solution 5: **Conversation Auto-Reset** (LAST RESORT) 🔄

Автоматично изчисти историята когато достигне threshold.

#### Implementation:

```javascript
// В quendooClaudeIntegration.js
const TOKEN_THRESHOLD = 150000; // 75% от лимита

// Before each request
const estimatedTokens = estimateTokens(history);
if (estimatedTokens > TOKEN_THRESHOLD) {
  console.warn(`[Quendoo] History approaching token limit (${estimatedTokens} tokens), clearing old messages`);

  // Keep only last 2 turns
  const keepMessages = 8; // 2 turns × 4 messages
  if (history.length > keepMessages) {
    const removed = history.length - keepMessages;
    history.splice(0, removed);
    console.log(`[Quendoo] Removed ${removed} old messages from history`);
  }
}
```

---

## 🎯 ПРЕПОРЪЧАНА СТРАТЕГИЯ (HYBRID APPROACH)

Комбинация от горните решения:

### Phase 1: **Immediate Fixes** (Deploy сега)
1. ✅ **Reduce excerpt size:** 800 → 500 chars (документирано в Solution 2A)
2. ✅ **Reduce default results:** 3 → 2 documents (документирано в Solution 2B)
3. ✅ **Add token monitoring:** Log actual usage (документирано в Solution 4)

**Очаквано:** ~40% намаление на tool result size

---

### Phase 2: **Smart Truncation** (Deploy тази седмица)
1. ✅ **Implement smartTruncateHistory()** (документирано в Solution 1)
2. ✅ **Keep last 3 turns fully, truncate older tool results**
3. ✅ **Test with real conversations**

**Очаквано:** ~70% намаление на история от стари tool results

---

### Phase 3: **Prevention** (Deploy следваща седмица)
1. ✅ **Rate limit tool calls:** Max 3 per turn (документирано в Solution 3)
2. ✅ **Auto-reset при threshold** (документирано в Solution 5)
3. ✅ **Frontend "Clear History" button**

**Очаквано:** Предотвратява token explosions напълно

---

## 📈 Expected Impact

### Current State (BEFORE):
- History (20 msgs): ~18,000 tokens (with full tool results)
- **Risk of hitting 200K limit:** ⚠️ HIGH (при 10+ tool calls)

### After Phase 1 (IMMEDIATE):
- Tool results: 590 → **~350 tokens** (-40%)
- History (20 msgs): ~11,000 tokens
- **Risk:** ⚠️ MEDIUM

### After Phase 2 (THIS WEEK):
- Old tool results: 590 → **~10 tokens** (-98%)
- History (20 msgs): **~6,000 tokens** (only last 3 turns fully)
- **Risk:** ✅ LOW

### After Phase 3 (NEXT WEEK):
- Max 3 tool calls per turn
- Auto-reset при 150K tokens
- **Risk:** ✅ VERY LOW (elimated token explosions)

---

## 🚀 Implementation Priority

### 🔴 URGENT (Deploy днес):
1. Add token usage monitoring (Solution 4)
2. Reduce excerpt size to 500 chars (Solution 2A)

### 🟡 HIGH (Deploy тази седмица):
1. Implement smart truncation (Solution 1)
2. Reduce default results to 2 (Solution 2B)

### 🟢 MEDIUM (Deploy следваща седмица):
1. Rate limit tool calls (Solution 3)
2. Auto-reset threshold (Solution 5)

---

## 📝 Testing Plan

### Test Scenario 1: Document Search (Heavy)
- User: "покажи ми резервация 442231"
- Expected: 1 tool call, ~350 tokens result
- Repeat 5 times
- Expected total: ~5,000 + (5 × 350) = **~6,750 tokens**

### Test Scenario 2: Mixed Operations
- 3× document searches
- 2× make_call
- 1× list_documents
- Expected: ~5,000 + (3×350 + 2×250 + 1×200) = **~6,800 tokens**

### Test Scenario 3: Long Conversation (20+ turns)
- Simulate 20 user messages with various operations
- Smart truncation should keep only last 3 turns fully
- Expected: ~5,000 + (3 turns × 400 avg) = **~6,200 tokens**
- Old messages: 17 turns × 10 tokens (truncated) = **~170 tokens**
- **Total: ~6,370 tokens** (3.2% от лимита)

---

## ✅ Success Metrics

1. **Token usage < 50K** за нормална конверсация (10-15 turns)
2. **No token limit errors** при 20+ turns с smart truncation
3. **Response quality maintained** (Claude има достатъчно контекст)
4. **User satisfaction** (не губи важна информация от историята)

---

## 🔧 Rollback Plan

Ако има проблеми:
1. **Revert excerpt size:** 500 → 800 chars
2. **Disable smart truncation:** Keep full history
3. **Fall back to:** History limit = 12 messages (3 turns) без truncation

---

## 📞 Next Steps

1. **Review this plan** с екипа
2. **Approve Phase 1** за deployment днес
3. **Deploy & monitor** token usage logs
4. **Analyze real data** след 24 часа
5. **Plan Phase 2** implementation на база реални данни
