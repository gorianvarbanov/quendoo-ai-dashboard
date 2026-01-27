# Quendoo AI - Multi-Agent System Guide

## 🚀 Quick Start

### 1. Start the Multi-Agent System

The agent system initializes automatically when the backend starts. Check status:

```bash
curl http://localhost:8080/api/agents/status
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalAgents": 1,
    "agents": [
      {
        "name": "analytics",
        "model": "claude-haiku-3-5-20241022",
        "capabilities": ["analytics", "reporting", "forecasting", "data_analysis"]
      }
    ],
    "orchestratorModel": "claude-sonnet-4-20250514"
  },
  "health": {
    "orchestrator": {
      "status": "healthy",
      "model": "claude-sonnet-4-20250514"
    },
    "analytics": {
      "status": "healthy",
      "model": "claude-haiku-3-5-20241022",
      "capabilities": 4
    }
  }
}
```

### 2. Send a Message

```bash
curl -X POST http://localhost:8080/api/agents/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_HOTEL_TOKEN" \
  -d '{
    "message": "Покажи ми revenue за последния месец",
    "language": "bg",
    "conversationId": "conv_123"
  }'
```

Response:
```json
{
  "success": true,
  "response": "📊 **Revenue Analysis за последните 30 дни**\n\n...",
  "metadata": {
    "agentResults": [...],
    "usage": {
      "input_tokens": 450,
      "output_tokens": 320
    }
  }
}
```

---

## 🎯 How It Works

### Orchestrator Flow

```
User Message
    │
    ▼
Orchestrator Agent (Sonnet 4)
    │
    ├──→ Analyze Intent
    │    └──→ Determine task type, complexity, required agents
    │
    ├──→ Simple Query?
    │    └──→ Single Agent → Response
    │
    └──→ Complex Query?
         └──→ Multiple Agents (parallel) → Synthesize → Response
```

### Example: Simple Query

**User:** "Колко bookings имам днес?"

```javascript
Orchestrator:
  Intent: { type: 'analytics', complexity: 'simple', agents: ['analytics'] }

  → Analytics Agent fetches data
  → Analytics Agent analyzes
  → Orchestrator synthesizes response

Response: "📅 **Bookings днес**: 7 bookings за общо €1,245"
```

### Example: Complex Query

**User:** "Оптимизирай цените за следващата седмица"

```javascript
Orchestrator:
  Intent: {
    type: 'revenue',
    complexity: 'complex',
    agents: ['analytics', 'intelligence', 'revenue', 'rates']
  }

  → [PARALLEL]
     - Analytics Agent: Historical data & trends
     - Intelligence Agent: Competitor prices
     - Revenue Agent: Optimization algorithm

  → Revenue Agent: Calculate optimal prices
  → Rates Agent: Apply new rates
  → Orchestrator: Synthesize comprehensive response

Response: "✅ **Цените оптимизирани**:
- Увеличени с 18% за викенда (висок demand)
- Намалени с 8% вт-ср (low occupancy)
- Projected revenue: +€2,340"
```

---

## 📚 API Reference

### POST /api/agents/chat

Main chat endpoint using multi-agent orchestration.

**Request:**
```json
{
  "message": "User message in any language",
  "language": "bg",
  "conversationId": "conv_123" // optional
}
```

**Response:**
```json
{
  "success": true,
  "response": "AI response text",
  "metadata": {
    "agentResults": [
      {
        "agent": "analytics",
        "taskType": "revenue_analysis",
        "data": {...},
        "analysis": "...",
        "success": true
      }
    ],
    "usage": {
      "input_tokens": 450,
      "output_tokens": 320
    }
  }
}
```

### GET /api/agents/status

Get system health and statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalAgents": 9,
    "agents": [...],
    "orchestratorModel": "claude-sonnet-4-20250514"
  },
  "health": {...}
}
```

### GET /api/agents/list

List all available agents and capabilities.

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "name": "analytics",
      "model": "claude-haiku-3-5-20241022",
      "capabilities": ["analytics", "reporting", "forecasting", "data_analysis"]
    }
  ]
}
```

### POST /api/agents/direct/:agentName

Call specific agent directly (debugging/testing).

**Request:**
```json
{
  "message": "Revenue report for last month",
  "language": "en"
}
```

### GET /api/agents/conversation/:conversationId/history

Get conversation history from memory.

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "message": "User message",
      "response": {...},
      "timestamp": "2025-01-25T10:30:00Z"
    }
  ]
}
```

---

## 🛠️ Creating New Agents

### Step 1: Create Agent Class

```javascript
// backend/src/services/agents/RevenueAgent.js

import { BaseAgent } from './BaseAgent.js'
import Anthropic from '@anthropic-ai/sdk'

export class RevenueAgent extends BaseAgent {
  constructor() {
    super('Revenue', 'claude-sonnet-4-20250514')

    this.capabilities = [
      'pricing_optimization',
      'yield_management',
      'revenue_forecasting'
    ]

    this.permissions = {
      read: ['bookings', 'rates', 'competitors', 'revenue'],
      write: ['rates', 'pricing_rules'],
      delete: []
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }

  async execute({ message, intent, context }) {
    // 1. Determine specific revenue task
    const task = await this.determineTask(message)

    // 2. Fetch required data
    const data = await this.fetchData(task, context)

    // 3. Perform calculations/analysis
    const result = await this.analyze(data, task, context)

    // 4. Return structured result
    return {
      agent: this.name,
      task,
      result,
      success: true
    }
  }

  async determineTask(message) {
    // Logic to determine specific revenue task
  }

  async fetchData(task, context) {
    // Fetch data from Firestore/APIs
  }

  async analyze(data, task, context) {
    // Use Claude for analysis
  }
}
```

### Step 2: Register Agent

```javascript
// backend/src/services/agents/AgentRegistry.js

import { RevenueAgent } from './RevenueAgent.js'

async initialize() {
  this.registerAgent('analytics', new AnalyticsAgent())
  this.registerAgent('revenue', new RevenueAgent()) // NEW
  // ...
}
```

### Step 3: Test Agent

```bash
# Direct call to test
curl -X POST http://localhost:8080/api/agents/direct/revenue \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message": "Optimize prices for next week"}'
```

---

## 💰 Cost Optimization

### Model Selection

- **Orchestrator**: Sonnet 4 ($3/1M tokens) - Needs intelligence for coordination
- **Simple agents**: Haiku ($0.25/1M tokens) - Data fetching, CRUD operations
- **Complex agents**: Sonnet ($3/1M tokens) - Analysis, decision-making

### Cost Examples

| Query Type | Agents Used | Tokens | Cost |
|------------|-------------|--------|------|
| "Bookings днес?" | Analytics (Haiku) | ~500 | $0.0001 |
| "Revenue report" | Analytics (Haiku) | ~2,000 | $0.0005 |
| "Optimize prices" | 4 agents (mixed) | ~8,000 | $0.015 |
| Complex multi-agent | 6+ agents | ~15,000 | $0.030 |

**Average cost per interaction:** $0.002 - $0.010

---

## 🔍 Debugging

### Enable Verbose Logging

```javascript
// In BaseAgent.js
log(level, message, data = {}) {
  console.log(`[${this.name}] [${level}] [${new Date().toISOString()}]`, message, data)
}
```

### Check Agent Status

```bash
curl http://localhost:8080/api/agents/status | jq
```

### View Conversation History

```bash
curl http://localhost:8080/api/agents/conversation/conv_123/history | jq
```

### Direct Agent Call (Testing)

```bash
curl -X POST http://localhost:8080/api/agents/direct/analytics \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message": "Test message"}'
```

---

## 📋 Roadmap

### Phase 1: Foundation ✅
- [x] BaseAgent class
- [x] OrchestratorAgent
- [x] AgentRegistry
- [x] AnalyticsAgent
- [x] API endpoints

### Phase 2: Core Agents (In Progress)
- [ ] RevenueAgent
- [ ] RatesAgent
- [ ] MarketingAgent
- [ ] TroubleshootingAgent

### Phase 3: Advanced Agents
- [ ] OperationsAgent
- [ ] IntelligenceAgent
- [ ] GuestAgent
- [ ] AutomationAgent

### Phase 4: Advanced Features
- [ ] Agent-to-agent communication
- [ ] Workflow automation
- [ ] Learning from interactions
- [ ] Custom agent creation via API

---

## 🚨 Error Handling

Agents return structured results:

```javascript
// Success
{
  agent: "analytics",
  taskType: "revenue_analysis",
  data: {...},
  analysis: "...",
  success: true
}

// Error
{
  agent: "analytics",
  error: "Failed to fetch data: Connection timeout",
  success: false
}
```

Orchestrator handles agent failures gracefully:
- If one agent fails, others continue
- Partial results are synthesized
- User gets response with available data

---

## 📞 Support

Questions? Issues?
- Check logs: `docker logs quendoo-backend`
- Test agent health: `/api/agents/status`
- Direct agent testing: `/api/agents/direct/:agentName`

---

## 🎯 Best Practices

1. **Use Haiku for simple tasks** - Save costs
2. **Cache frequent queries** - Reduce API calls
3. **Validate permissions** - Check before execution
4. **Log everything** - Debugging is easier
5. **Handle errors gracefully** - Always return structured data
6. **Test agents individually** - Before multi-agent orchestration
7. **Monitor costs** - Track token usage per agent

---

Готов си за multi-agent бъдещето! 🚀
