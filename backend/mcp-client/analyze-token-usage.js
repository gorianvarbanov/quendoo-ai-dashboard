/**
 * Token Usage Analysis Script
 * Analyzes actual token usage in conversations to determine optimal history limits
 */

// Simulate different conversation scenarios
const scenarios = {
  // Scenario 1: Document search (typical Excel query)
  documentSearch: {
    userMessage: "покажи ми резервация 442231",
    assistantResponse: "Ще потърся информация за резервация 442231 в документите.",
    toolResult: {
      success: true,
      query: "резервация 442231",
      resultsCount: 3,
      results: [
        {
          rank: 1,
          fileName: "Reservations_January.xlsx",
          documentType: "other",
          relevanceScore: 0.92,
          excerpt: "Резервация номер: 442231 | Статус: Създадена | Име: olga | Фамилия: ivanova | Email: olga@example.com | Телефон: +359888123456 | Град: Sofia | Държава: Bulgaria | Начална дата: 2026-01-15 | Крайна дата: 2026-01-20 | Нощувки: 5 | Възрастни: 2 | Деца: 0 | Бебета: 0 | Тип настаняване: Полупансион | Цена на нощувка: 150.00 | Обща цена: 750.00 | Статус на плащане: Платено | Допълнителни услуги: SPA, Паркинг | Забележки: Искат тиха стая | Created At: 2025-12-20 10:30:00...".repeat(1), // ~800 chars
          tags: ["reservations", "2026"]
        },
        {
          rank: 2,
          fileName: "Reservations_January.xlsx",
          documentType: "other",
          relevanceScore: 0.85,
          excerpt: "Резервация номер: 442230 | Статус: Потвърдена | Име: maria | Фамилия: petrova | Email: maria@example.com | Телефон: +359888654321 | Град: Plovdiv | Държава: Bulgaria | Начална дата: 2026-01-10 | Крайна дата: 2026-01-15 | Нощувки: 5 | Възрастни: 2 | Деца: 1 | Бебета: 0 | Тип настаняване: Пълен пансион | Цена на нощувка: 180.00 | Обща цена: 900.00 | Статус на плащане: Депозит | Допълнителни услуги: Детска градина | Забележки: Алергия към ядки | Created At: 2025-12-18 14:20:00...".repeat(1),
          tags: ["reservations", "2026"]
        },
        {
          rank: 3,
          fileName: "Reservations_January.xlsx",
          documentType: "other",
          relevanceScore: 0.78,
          excerpt: "Резервация номер: 442232 | Статус: Анулирана | Име: ivan | Фамилия: georgiev | Email: ivan@example.com | Телефон: +359888987654 | Град: Varna | Държава: Bulgaria | Начална дата: 2026-01-25 | Крайна дата: 2026-01-30 | Нощувки: 5 | Възрастни: 3 | Деца: 2 | Бебета: 1 | Тип настаняване: All Inclusive | Цена на нощувка: 250.00 | Обща цена: 1250.00 | Статус на плащане: Възстановено | Допълнителни услуги: - | Забележки: Отменена заради болест | Created At: 2025-12-25 09:00:00...".repeat(1),
          tags: ["reservations", "2026"]
        }
      ],
      summary: "Found 3 relevant excerpt(s) from 1 document(s). Document types: other. Top result: \"Reservations_January.xlsx\" with 92% relevance."
    },
    assistantFinalResponse: "Намерих информация за резервация 442231:\n\n**Основна информация:**\n- Име: Olga Ivanova\n- Email: olga@example.com\n- Телефон: +359888123456\n\n**Период на престой:**\n- Начална дата: 15.01.2026\n- Крайна дата: 20.01.2026\n- Нощувки: 5\n\n**Настаняване:**\n- Тип: Полупансион\n- Възрастни: 2\n- Цена на нощувка: 150 лв\n- Обща цена: 750 лв\n\n**Статус:**\n- Резервация: Създадена\n- Плащане: Платено\n\n**Допълнително:**\n- Услуги: SPA, Паркинг\n- Забележки: Искат тиха стая"
  },

  // Scenario 2: make_call tool (phone call)
  makeCall: {
    userMessage: "обади се на +359888123456",
    assistantResponse: "Ще се обадя на +359888123456.",
    toolResult: {
      success: true,
      callId: "call_abc123xyz",
      status: "completed",
      duration: 45,
      transcript: "Оператор: Здравейте, Хотел Маритайм, с какво мога да помогна?\nКлиент: Здравейте, бих искал да попитам за налични стаи за уикенда.\nОператор: Разбира се, имаме свободни стаи. За колко лица търсите настаняване?\nКлиент: За двама възрастни и едно дете.\nОператор: Отлично, имам налична семейна стая с изглед към морето за 180 лева на нощувка.\nКлиент: Чудесно, бихте ли запазили стаята за петък и събота?\nОператор: С удоволствие! Ще имам нужда от вашите данни...\n".repeat(3), // ~600 chars
      summary: "Успешен разговор. Клиент иска резервация за уикенда."
    },
    assistantFinalResponse: "Обадих се успешно на +359888123456. Разговорът продължи 45 секунди.\n\n**Резюме:**\nКлиентът пита за налични стаи за уикенда за 2 възрастни и 1 дете. Предложена е семейна стая с морски изглед за 180 лв/нощувка. Клиентът иска да запази стаята за петък и събота."
  },

  // Scenario 3: List documents
  listDocuments: {
    userMessage: "покажи ми какви документи имате",
    assistantResponse: "Ще проверя наличните документи.",
    toolResult: {
      success: true,
      count: 8,
      documents: [
        { fileName: "Reservations_January.xlsx", documentType: "other", description: "Reservations for January 2026", tags: ["reservations"], uploadedAt: "15.01.2026", fileSize: "2.34 MB" },
        { fileName: "Hotel_Policy.pdf", documentType: "policy", description: "Hotel internal policies", tags: ["policy", "rules"], uploadedAt: "10.01.2026", fileSize: "456.78 KB" },
        { fileName: "Menu_Restaurant.pdf", documentType: "menu", description: "Restaurant menu", tags: ["menu", "food"], uploadedAt: "05.01.2026", fileSize: "1.23 MB" },
        { fileName: "Supplier_Contract.pdf", documentType: "contract", description: "Food supplier contract", tags: ["contract", "supplier"], uploadedAt: "01.01.2026", fileSize: "890.12 KB" },
        { fileName: "Staff_Manual.pdf", documentType: "manual", description: "Staff procedures manual", tags: ["manual", "staff"], uploadedAt: "20.12.2025", fileSize: "3.45 MB" },
        { fileName: "Invoice_December.pdf", documentType: "invoice", description: "December invoices", tags: ["invoice", "finance"], uploadedAt: "31.12.2025", fileSize: "678.90 KB" },
        { fileName: "Safety_Procedures.pdf", documentType: "procedure", description: "Emergency procedures", tags: ["safety", "emergency"], uploadedAt: "15.12.2025", fileSize: "1.12 MB" },
        { fileName: "Reservations_December.xlsx", documentType: "other", description: "Reservations for December 2025", tags: ["reservations"], uploadedAt: "01.12.2025", fileSize: "2.01 MB" }
      ]
    },
    assistantFinalResponse: "Имате общо 8 документа:\n\n1. **Reservations_January.xlsx** (2.34 MB) - Резервации за януари 2026\n2. **Hotel_Policy.pdf** (456.78 KB) - Вътрешни правила на хотела\n3. **Menu_Restaurant.pdf** (1.23 MB) - Меню на ресторанта\n4. **Supplier_Contract.pdf** (890.12 KB) - Договор с доставчик на храна\n5. **Staff_Manual.pdf** (3.45 MB) - Наръчник за персонала\n6. **Invoice_December.pdf** (678.90 KB) - Фактури от декември\n7. **Safety_Procedures.pdf** (1.12 MB) - Процедури при извънредни ситуации\n8. **Reservations_December.xlsx** (2.01 MB) - Резервации от декември"
  }
};

// Simple token estimator (3.5 chars per token on average)
function estimateTokens(text) {
  if (typeof text === 'object') {
    text = JSON.stringify(text);
  }
  return Math.ceil(text.length / 3.5);
}

// Calculate size of one conversation turn
function calculateTurnSize(scenario) {
  const userTokens = estimateTokens(scenario.userMessage);
  const assistantResponseTokens = estimateTokens(scenario.assistantResponse);
  const toolResultTokens = estimateTokens(scenario.toolResult);
  const assistantFinalTokens = estimateTokens(scenario.assistantFinalResponse);

  const total = userTokens + assistantResponseTokens + toolResultTokens + assistantFinalTokens;

  return {
    user: userTokens,
    assistantThinking: assistantResponseTokens,
    toolResult: toolResultTokens,
    assistantFinal: assistantFinalTokens,
    total: total,
    messages: 3 // user message + assistant (thinking + tool_use) + user (tool_result) + assistant (final)
  };
}

// Simulate conversation history growth
function simulateConversation(scenarioType, turns) {
  const scenario = scenarios[scenarioType];
  const history = [];
  let totalTokens = 0;

  console.log(`\n=== Симулация: ${scenarioType} (${turns} повторения) ===\n`);

  for (let i = 1; i <= turns; i++) {
    // User message
    history.push({
      role: 'user',
      content: [{ type: 'text', text: scenario.userMessage }]
    });

    // Assistant thinking + tool_use
    history.push({
      role: 'assistant',
      content: [
        { type: 'text', text: scenario.assistantResponse },
        { type: 'tool_use', id: `toolu_${i}`, name: 'test_tool', input: {} }
      ]
    });

    // Tool result
    history.push({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: `toolu_${i}`, content: JSON.stringify(scenario.toolResult) }
      ]
    });

    // Assistant final response
    history.push({
      role: 'assistant',
      content: [{ type: 'text', text: scenario.assistantFinalResponse }]
    });

    const currentTokens = estimateTokens(JSON.stringify(history));
    const turnSize = calculateTurnSize(scenario);

    console.log(`Turn ${i}: ${currentTokens.toLocaleString()} tokens (${history.length} messages) - добавени ${turnSize.total} tokens`);

    // Check if we hit limits
    if (currentTokens > 200000) {
      console.log(`⚠️ ПРЕВИШЕН ЛИМИТ при turn ${i}!`);
      break;
    }

    totalTokens = currentTokens;
  }

  return { totalTokens, messages: history.length };
}

// Main analysis
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║          TOKEN USAGE ANALYSIS - CONVERSATION HISTORY          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Analyze individual turn sizes
console.log('📊 РАЗМЕР НА ЕДИН TURN (request-response cycle):');
console.log('─'.repeat(70));

for (const [name, scenario] of Object.entries(scenarios)) {
  const size = calculateTurnSize(scenario);
  console.log(`\n${name}:`);
  console.log(`  User message:          ${size.user.toString().padStart(6)} tokens`);
  console.log(`  Assistant thinking:    ${size.assistantThinking.toString().padStart(6)} tokens`);
  console.log(`  Tool result:           ${size.toolResult.toString().padStart(6)} tokens`);
  console.log(`  Assistant final:       ${size.assistantFinal.toString().padStart(6)} tokens`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  TOTAL per turn:        ${size.total.toString().padStart(6)} tokens (${size.messages} messages)`);
}

// System prompt and tools baseline
const systemPromptSize = 3007; // From logs
const toolsSize = 2052; // From logs
const baseline = systemPromptSize + toolsSize;

console.log('\n\n📌 BASELINE (system + tools):');
console.log('─'.repeat(70));
console.log(`  System prompt:         ${systemPromptSize.toString().padStart(6)} tokens`);
console.log(`  Tools definitions:     ${toolsSize.toString().padStart(6)} tokens`);
console.log(`  ─────────────────────────────────────`);
console.log(`  BASELINE TOTAL:        ${baseline.toString().padStart(6)} tokens`);
console.log(`  Available for history: ${(200000 - baseline).toLocaleString()} tokens (with 200K limit)`);

// Simulate different scenarios
console.log('\n\n🔄 СИМУЛАЦИЯ НА НАТРУПВАНЕ НА ИСТОРИЯ:\n');

// Scenario 1: Document search only
const docSearch = simulateConversation('documentSearch', 50);

// Scenario 2: Make call only
const makeCallSim = simulateConversation('makeCall', 50);

// Scenario 3: Mixed conversation
console.log('\n=== Симулация: Mixed conversation ===\n');
console.log('3x document search + 2x make_call + 1x list_documents\n');
const mixedTurns = [
  ...Array(3).fill('documentSearch'),
  ...Array(2).fill('makeCall'),
  'listDocuments'
];
let mixedHistory = [];
let mixedTokens = 0;
for (let i = 0; i < mixedTurns.length; i++) {
  const scenario = scenarios[mixedTurns[i]];
  const turnSize = calculateTurnSize(scenario);
  mixedTokens += turnSize.total;
  mixedHistory.push(...Array(4).fill(null)); // 4 messages per turn
  console.log(`Turn ${i + 1} (${mixedTurns[i]}): ${mixedTokens.toLocaleString()} tokens (${mixedHistory.length} messages)`);
}

// Calculate optimal history limits
console.log('\n\n💡 ПРЕПОРЪКИ ЗА HISTORY LIMIT:\n');
console.log('─'.repeat(70));

const limits = [4, 6, 8, 10, 12, 16, 20];
const avgTurnSize = calculateTurnSize(scenarios.documentSearch).total; // Use doc search as average

console.log(`Baseline: ${baseline.toLocaleString()} tokens`);
console.log(`Average turn size: ${avgTurnSize.toLocaleString()} tokens\n`);

for (const limit of limits) {
  const turns = Math.floor(limit / 4); // 4 messages per turn
  const historyTokens = turns * avgTurnSize;
  const total = baseline + historyTokens;
  const percentage = (total / 200000 * 100).toFixed(1);
  const status = total < 150000 ? '✅ SAFE' : total < 180000 ? '⚠️ WARNING' : '❌ DANGER';

  console.log(`${limit.toString().padStart(2)} messages (${turns} turns): ${total.toLocaleString().padStart(7)} tokens (${percentage.padStart(5)}% of limit) ${status}`);
}

console.log('\n\n🎯 ФИНАЛЕН АНАЛИЗ:\n');
console.log('─'.repeat(70));
console.log(`
1. БАЗОВА КОНСТАТАЦИЯ:
   - System + Tools = ${baseline.toLocaleString()} tokens (фиксирано)
   - Available space = ${(200000 - baseline).toLocaleString()} tokens
   - Average turn = ~${avgTurnSize.toLocaleString()} tokens (4 messages)

2. ПРОБЛЕМИ:
   - Document search tool result = ~${calculateTurnSize(scenarios.documentSearch).toolResult.toLocaleString()} tokens (3 excerpts × 800 chars)
   - Make call transcript = ~${calculateTurnSize(scenarios.makeCall).toolResult.toLocaleString()} tokens
   - При 6 messages (1.5 turn) = ~${(avgTurnSize * 1.5).toLocaleString()} tokens history
   - TOTAL: ${baseline.toLocaleString()} + ${(avgTurnSize * 1.5).toLocaleString()} = ~${(baseline + avgTurnSize * 1.5).toLocaleString()} tokens

3. ВЪЗМОЖНИ РЕШЕНИЯ:

   A) АГРЕСИВНО ОГРАНИЧАВАНЕ НА HISTORY:
      ✅ Limit = 4 messages (1 turn) = ~${(baseline + avgTurnSize).toLocaleString()} tokens
      ⚠️ Минус: Claude губи контекст много бързо

   B) НАМАЛЯВАНЕ НА TOOL RESULTS:
      - Limit excerpts to 400 chars instead of 800
      - Return only top 2 results instead of 3
      - Estimated savings: ~50% = ${Math.floor(calculateTurnSize(scenarios.documentSearch).toolResult / 2).toLocaleString()} tokens per search

   C) ИНТЕЛИГЕНТНО СКЪСЯВАНЕ (SMART TRUNCATION):
      - Пази последните 2-3 turns (8-12 messages)
      - Премахва tool_result съдържание от по-стари съобщения
      - Оставя само user/assistant текст за контекст
      - Estimated: ~${baseline + avgTurnSize * 2}.toLocaleString()} tokens for 3 turns

   D) CONVERSATION SUMMARIZATION:
      - След всеки 5-6 turns, обобщи историята в 1 message
      - Премахни старите messages, остави summary
      - Оценка: ~${baseline + 1000}.toLocaleString()} tokens (summary) + ${avgTurnSize * 2}.toLocaleString()} (2 turns) = ${(baseline + 1000 + avgTurnSize * 2).toLocaleString()} tokens

4. ПРЕПОРЪЧАНО РЕШЕНИЕ (комбинация):

   ✨ HYBRID APPROACH:

   а) Намали excerpt size: 800 → 500 chars (-37% tokens в tool results)
   б) Limit results: 3 → 2 documents (-33% tokens в tool results)
   в) Smart truncation: Пази последните 3 turns (12 messages) пълни
                        Премахни tool_result content от по-стари съобщения
   г) Clear history button: Позволи на потребителя да чисти history ръчно

   Очаквано натоварване:
   - Baseline: ${baseline.toLocaleString()} tokens
   - 3 turns × ${Math.floor(avgTurnSize * 0.6).toLocaleString()} tokens (намалени results) = ${(Math.floor(avgTurnSize * 0.6) * 3).toLocaleString()} tokens
   - TOTAL: ~${(baseline + Math.floor(avgTurnSize * 0.6) * 3).toLocaleString()} tokens (~${((baseline + Math.floor(avgTurnSize * 0.6) * 3) / 200000 * 100).toFixed(1)}% от лимита)

   ✅ Margin за сложни операции: ${(200000 - (baseline + Math.floor(avgTurnSize * 0.6) * 3)).toLocaleString()} tokens

5. БОНУС - MONITORING:
   - Log actual token usage from Claude API errors
   - Track: response.usage.input_tokens (ако е налично в API response)
   - Alert когато > 180K tokens (90% от лимита)
`);

console.log('\n╚════════════════════════════════════════════════════════════════╝\n');
