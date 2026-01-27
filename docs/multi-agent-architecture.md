# Quendoo AI - Multi-Agent Architecture Plan

## Vision
Transform Quendoo from a simple chatbot into a comprehensive AI-powered hotel management platform with specialized agents handling different aspects of hotel operations.

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│         ORCHESTRATOR AGENT (Claude Sonnet 4)             │
│  - Intent recognition                                    │
│  - Agent coordination                                    │
│  - Response synthesis                                    │
│  - Conversation memory                                   │
└────────────┬─────────────────────────────────────────────┘
             │
             ├──→ 📊 Analytics Agent (Haiku)
             │    APIs: /api/analytics/*
             │
             ├──→ 🔧 Troubleshooting Agent (Sonnet)
             │    APIs: /api/diagnostics/*
             │
             ├──→ 💰 Revenue Agent (Sonnet)
             │    APIs: /api/revenue/*
             │
             ├──→ 📅 Rates Agent (Haiku)
             │    APIs: /api/rates/*
             │
             ├──→ 🎯 Marketing Agent (Sonnet)
             │    APIs: /api/promotions/*
             │
             ├──→ 👥 Guest Agent (Haiku)
             │    APIs: /api/guests/*
             │
             ├──→ 🏠 Operations Agent (Haiku)
             │    APIs: /api/operations/*
             │
             ├──→ 📈 Intelligence Agent (Sonnet)
             │    APIs: /api/competitors/*
             │
             └──→ 🤖 Automation Agent (Haiku)
                  APIs: /api/workflows/*
```

---

## 📋 API Endpoints per Agent

### 1. 📊 Analytics Agent

**Purpose:** Data analysis, reporting, insights

**APIs:**
- `POST /api/analytics/revenue-report` - Generate revenue reports
- `POST /api/analytics/occupancy-trends` - Analyze occupancy trends
- `POST /api/analytics/booking-patterns` - Booking pattern analysis
- `POST /api/analytics/channel-performance` - Channel performance comparison
- `POST /api/analytics/forecast` - Revenue & occupancy forecasting
- `GET /api/analytics/dashboard` - Real-time dashboard data
- `POST /api/analytics/custom-query` - Custom SQL-like queries
- `GET /api/analytics/kpis` - Key performance indicators

**Example User Requests:**
- "Покажи ми revenue за последния месец"
- "Кои дни имам най-висок occupancy?"
- "Анализ на bookings по канали"
- "Forecast за следващата седмица"

---

### 2. 🔧 Troubleshooting Agent

**Purpose:** Diagnose and fix issues with systems, integrations, bookings

**APIs:**
- `POST /api/diagnostics/check-integrations` - Test API integrations
- `POST /api/diagnostics/booking-issues` - Identify booking problems
- `POST /api/diagnostics/sync-status` - Check sync status with OTAs
- `POST /api/diagnostics/rate-parity` - Check rate parity violations
- `POST /api/diagnostics/availability-gaps` - Find availability mismatches
- `POST /api/diagnostics/system-health` - Overall system health check
- `POST /api/diagnostics/fix-issue` - Auto-fix common issues
- `GET /api/diagnostics/logs` - Retrieve error logs

**Example User Requests:**
- "Защо не получавам bookings от Booking.com?"
- "Има ли проблем с синхронизацията?"
- "Check rate parity между каналите"
- "Fix overbooking за утре"

---

### 3. 💰 Revenue Management Agent

**Purpose:** Pricing optimization, yield management, revenue strategies

**APIs:**
- `POST /api/revenue/optimize-prices` - AI-powered price optimization
- `POST /api/revenue/dynamic-pricing` - Apply dynamic pricing rules
- `POST /api/revenue/competitor-analysis` - Analyze competitor pricing
- `POST /api/revenue/yield-management` - Yield management recommendations
- `POST /api/revenue/price-forecast` - Forecast optimal prices
- `POST /api/revenue/revpar-analysis` - RevPAR analysis and improvement
- `POST /api/revenue/length-of-stay-pricing` - LOS-based pricing
- `GET /api/revenue/pricing-rules` - Get current pricing rules
- `POST /api/revenue/update-pricing-rules` - Update pricing rules

**Example User Requests:**
- "Оптимизирай цените за следващата седмица"
- "Какви цени имат конкурентите?"
- "Препоръчай pricing strategy за Коледа"
- "Увеличи RevPAR с 10%"

---

### 4. 📅 Rates & Availability Agent

**Purpose:** Manage room rates, rate plans, availability, restrictions

**APIs:**
- `POST /api/rates/create-rate` - Create new rate plan
- `PUT /api/rates/update-rate` - Update existing rate
- `DELETE /api/rates/delete-rate` - Delete rate plan
- `POST /api/rates/bulk-update` - Bulk rate updates
- `POST /api/rates/set-availability` - Set room availability
- `POST /api/rates/restrictions` - Set booking restrictions (min stay, etc.)
- `GET /api/rates/calendar` - Get rate calendar
- `POST /api/rates/seasonal-rates` - Create seasonal rate plans
- `POST /api/rates/special-offers` - Create special rate offers
- `POST /api/rates/rate-validation` - Validate rate configuration

**Example User Requests:**
- "Създай нов rate plan за корпоративни клиенти"
- "Затвори bookings за следващата седмица"
- "Set minimum stay 3 nights за декември"
- "Увеличи всички цени с 15% за викенда"

---

### 5. 🎯 Marketing & Promotions Agent

**Purpose:** Create and manage promotions, campaigns, special offers

**APIs:**
- `POST /api/promotions/create` - Create new promotion
- `PUT /api/promotions/update` - Update existing promotion
- `DELETE /api/promotions/delete` - Delete promotion
- `GET /api/promotions/active` - Get active promotions
- `POST /api/promotions/analyze-performance` - Analyze promotion ROI
- `POST /api/promotions/flash-sale` - Create flash sale
- `POST /api/promotions/early-bird` - Create early bird discount
- `POST /api/promotions/last-minute` - Create last-minute deals
- `POST /api/promotions/package-deal` - Create package offers
- `POST /api/promotions/coupon` - Generate coupon codes

**Example User Requests:**
- "Направи промоция 20% за следващата седмица"
- "Създай early bird оферта за лятото"
- "Генерирай flash sale за днес"
- "Какви промоции работят най-добре?"

---

### 6. 👥 Guest Management Agent

**Purpose:** Guest data, preferences, communication, loyalty

**APIs:**
- `GET /api/guests/search` - Search guests
- `GET /api/guests/:id/profile` - Get guest profile
- `PUT /api/guests/:id/preferences` - Update guest preferences
- `GET /api/guests/:id/history` - Guest booking history
- `POST /api/guests/segment` - Segment guests by criteria
- `POST /api/guests/send-message` - Send message to guest(s)
- `GET /api/guests/vip` - Get VIP guests
- `POST /api/guests/loyalty-points` - Manage loyalty points
- `POST /api/guests/feedback-request` - Request guest feedback
- `GET /api/guests/upcoming-arrivals` - Upcoming guest arrivals

**Example User Requests:**
- "Кои VIP гости идват тази седмица?"
- "Изпрати welcome message на утрешните гости"
- "Покажи история на този гост"
- "Segment гости по spending"

---

### 7. 🏠 Operations Management Agent

**Purpose:** Housekeeping, maintenance, staff management, inventory

**APIs:**
- `GET /api/operations/housekeeping-status` - Room cleaning status
- `POST /api/operations/assign-task` - Assign housekeeping task
- `GET /api/operations/maintenance-requests` - Get maintenance issues
- `POST /api/operations/report-issue` - Report maintenance issue
- `POST /api/operations/staff-schedule` - Manage staff schedules
- `GET /api/operations/inventory` - Inventory levels
- `POST /api/operations/order-supplies` - Order supplies
- `GET /api/operations/room-status` - Real-time room status
- `POST /api/operations/checkout-checklist` - Checkout procedures

**Example User Requests:**
- "Кои стаи са готови за check-in?"
- "Report проблем с климатика в стая 205"
- "Кой е на дежурство утре?"
- "Нужни са нови хавлиени кърпи"

---

### 8. 📈 Competitive Intelligence Agent

**Purpose:** Monitor competitors, market trends, benchmark performance

**APIs:**
- `POST /api/competitors/scrape-prices` - Scrape competitor prices
- `POST /api/competitors/compare` - Compare with competitors
- `POST /api/competitors/market-analysis` - Analyze market trends
- `POST /api/competitors/position-analysis` - Competitive positioning
- `GET /api/competitors/alerts` - Price/availability alerts
- `POST /api/competitors/reviews-analysis` - Analyze competitor reviews
- `POST /api/competitors/market-share` - Estimate market share
- `POST /api/competitors/gap-analysis` - Identify competitive gaps

**Example User Requests:**
- "Какви цени има Hotel X утре?"
- "Comparison с топ 3 конкуренти"
- "Как се представям спрямо пазара?"
- "Кой е най-евтин в района?"

---

### 9. 🤖 Automation & Workflows Agent

**Purpose:** Automate repetitive tasks, create workflows, scheduled actions

**APIs:**
- `POST /api/workflows/create` - Create new workflow
- `GET /api/workflows/list` - List all workflows
- `PUT /api/workflows/:id/enable` - Enable workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `POST /api/workflows/schedule` - Schedule automated task
- `GET /api/workflows/execution-history` - Workflow execution logs
- `POST /api/automation/auto-responses` - Set up auto-responses
- `POST /api/automation/price-adjustment` - Auto price adjustments
- `POST /api/automation/reports` - Schedule automated reports
- `POST /api/automation/notifications` - Set up notifications

**Example User Requests:**
- "Всяка неделя автоматично увеличи цените с 10%"
- "Автоматично изпращай welcome email при booking"
- "Daily report на occupancy в 9 сутринта"
- "Auto-apply динамично pricing"

---

## 🎯 Agent Interaction Examples

### Example 1: Complex Revenue Optimization

**User:** "Оптимизирай revenue за следващите 2 седмици"

```javascript
Orchestrator analyzes → Complex task, requires multiple agents

1. Analytics Agent:
   - Fetch historical data
   - Identify patterns
   - Forecast demand

2. Intelligence Agent:
   - Scrape competitor prices
   - Market analysis
   - Positioning

3. Revenue Agent:
   - Calculate optimal prices
   - Dynamic pricing rules
   - Yield management

4. Rates Agent:
   - Apply new rates
   - Set restrictions
   - Update calendar

5. Orchestrator synthesizes:
   "✅ Оптимизирах цените за следващите 14 дни:
   - Увеличени с 18% за викендите (висок demand)
   - Намалени с 8% за вторник-сряда (low occupancy)
   - Added min stay 2 nights за 15-17 Dec
   - Projected revenue increase: +€2,340"
```

### Example 2: Troubleshooting Booking Issue

**User:** "Няма bookings от Booking.com от 2 дни"

```javascript
Orchestrator → Troubleshooting task

1. Troubleshooting Agent:
   - Check API integration
   - Test connectivity
   - Check sync status
   - Review error logs

2. Rates Agent:
   - Check if availability is open
   - Verify rates are published

3. Diagnostics finds issue:
   "❌ API key expired on Dec 20
   ❌ Sync stopped 2 days ago
   ✅ I can fix this automatically"

4. Auto-fix:
   - Refresh API credentials
   - Restart sync
   - Verify connection

5. Orchestrator reports:
   "✅ Fixed! Problem: API key expired.
   - Refreshed credentials
   - Sync resumed
   - Test booking successful
   You should start receiving bookings again."
```

### Example 3: Create Promotion Campaign

**User:** "Направи промоция за Нова Година - 25% discount, early bird до 15 Jan"

```javascript
Orchestrator → Marketing task

1. Marketing Agent:
   - Create promotion logic
   - Set discount parameters
   - Generate campaign

2. Rates Agent:
   - Create promotional rate
   - Apply to calendar
   - Set booking window

3. Automation Agent:
   - Schedule start/end dates
   - Set up notifications
   - Track performance

4. Orchestrator confirms:
   "✅ Промоцията е активна:
   🎉 25% OFF за Нова Година
   📅 Valid: 31 Dec - 2 Jan
   🏷️ Early bird до 15 Jan
   💰 Expected bookings: +12
   📊 I'll track performance and report back"
```

---

## 🛠️ Implementation Plan

### Phase 1: Foundation (Week 1-2)
- [x] Create orchestrator agent service
- [ ] Design agent communication protocol
- [ ] Implement agent registry
- [ ] Create base agent class

### Phase 2: Core Agents (Week 3-4)
- [ ] Analytics Agent + APIs
- [ ] Rates Agent + APIs
- [ ] Revenue Agent + APIs
- [ ] Troubleshooting Agent + APIs

### Phase 3: Advanced Agents (Week 5-6)
- [ ] Marketing Agent + APIs
- [ ] Operations Agent + APIs
- [ ] Intelligence Agent + APIs
- [ ] Guest Agent + APIs

### Phase 4: Automation (Week 7-8)
- [ ] Automation Agent + APIs
- [ ] Workflow engine
- [ ] Scheduled tasks
- [ ] Notifications system

### Phase 5: Polish & Optimize (Week 9-10)
- [ ] Agent performance optimization
- [ ] Cost optimization (use Haiku where possible)
- [ ] Error handling & fallbacks
- [ ] Documentation & testing

---

## 💰 Cost Optimization

| Agent Type | Model | Cost per 1M tokens | Use Case |
|------------|-------|-------------------|-----------|
| Orchestrator | Sonnet 4 | $3 | Intent, coordination |
| Analytics | Haiku | $0.25 | Data queries, simple reports |
| Revenue | Sonnet | $3 | Complex pricing decisions |
| Rates | Haiku | $0.25 | CRUD operations |
| Marketing | Sonnet | $3 | Creative campaigns |
| Troubleshooting | Sonnet | $3 | Complex diagnostics |
| Operations | Haiku | $0.25 | Task management |
| Intelligence | Sonnet | $3 | Market analysis |
| Automation | Haiku | $0.25 | Scheduled tasks |

**Average cost per interaction:** $0.02 - $0.10 (depending on complexity)

---

## 🔒 Security & Permissions

Each agent should have role-based permissions:

```javascript
{
  "agent": "revenue",
  "permissions": {
    "read": ["rates", "bookings", "analytics"],
    "write": ["rates", "pricing-rules"],
    "delete": []
  }
}
```

---

## 📊 Success Metrics

1. **Task Completion Rate:** >95%
2. **Average Response Time:** <5s
3. **Cost per Interaction:** <$0.10
4. **User Satisfaction:** >4.5/5
5. **Revenue Impact:** +15% from AI recommendations

---

## 🚀 Next Steps

1. Review and approve architecture
2. Prioritize which agents to build first
3. Define API contracts
4. Start with Phase 1 implementation
