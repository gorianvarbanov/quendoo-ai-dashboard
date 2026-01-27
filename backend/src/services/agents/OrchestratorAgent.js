/**
 * Orchestrator Agent
 * Main coordinator that analyzes user intent and delegates to specialized agents
 */

import Anthropic from '@anthropic-ai/sdk'
import { BaseAgent } from './BaseAgent.js'

export class OrchestratorAgent extends BaseAgent {
  constructor(agentRegistry) {
    super('Orchestrator', 'claude-sonnet-4-20250514')
    this.agentRegistry = agentRegistry
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
    this.conversationMemory = new Map()
  }

  /**
   * Main entry point for user messages
   */
  async execute(userMessage, context) {
    try {
      this.log('INFO', 'Processing user message', { message: userMessage })

      // Step 1: Analyze intent and determine which agents to use
      const intent = await this.analyzeIntent(userMessage, context)
      this.log('INFO', 'Intent analyzed', intent)

      // Step 2: Check if this is a simple query (single agent) or complex (multi-agent)
      if (intent.complexity === 'simple') {
        return await this.handleSimpleQuery(userMessage, intent, context)
      } else {
        return await this.handleComplexQuery(userMessage, intent, context)
      }

    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * Analyze user intent using Claude
   */
  async analyzeIntent(message, context) {
    const systemPrompt = `You are an intent analyzer for a hotel management AI system.

Analyze the user's message and determine:
1. Task type (analytics, revenue, rates, promotions, troubleshooting, operations, guests, automation)
2. Complexity (simple or complex)
3. Required agents (list of agent names)
4. Urgency (low, medium, high)
5. Required data/context

Available agents:
- analytics: Data analysis, reports, forecasts
- revenue: Pricing optimization, yield management
- rates: Rate plans, availability, restrictions
- marketing: Promotions, campaigns, special offers
- troubleshooting: Diagnose issues, fix problems
- operations: Housekeeping, maintenance, staff
- intelligence: Competitor analysis, market trends
- guests: Guest management, communication
- automation: Workflows, scheduled tasks

Respond ONLY with valid JSON in this format:
{
  "type": "analytics" | "revenue" | "rates" | "marketing" | "troubleshooting" | "operations" | "intelligence" | "guests" | "automation",
  "complexity": "simple" | "complex",
  "agents": ["agent1", "agent2"],
  "urgency": "low" | "medium" | "high",
  "requiresData": ["booking_data", "rate_data"],
  "reasoning": "brief explanation"
}`

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Hotel ID: ${context.hotelId}\nLanguage: ${context.language}\n\nUser message: "${message}"`
        }
      ]
    })

    const intentText = response.content[0].text

    // Parse JSON from response
    try {
      const jsonMatch = intentText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      throw new Error('No JSON found in intent response')
    } catch (error) {
      this.log('WARN', 'Failed to parse intent JSON, using defaults', { error: error.message })
      // Fallback to simple analytics
      return {
        type: 'analytics',
        complexity: 'simple',
        agents: ['analytics'],
        urgency: 'medium',
        requiresData: [],
        reasoning: 'Fallback due to parse error'
      }
    }
  }

  /**
   * Handle simple queries (single agent)
   */
  async handleSimpleQuery(message, intent, context) {
    const agentName = intent.agents[0]
    const agent = this.agentRegistry.getAgent(agentName)

    if (!agent) {
      throw new Error(`Agent ${agentName} not found`)
    }

    this.log('INFO', `Delegating to ${agentName} agent`)

    // Execute agent
    const result = await agent.execute({
      message,
      intent,
      context
    })

    // Synthesize response
    return await this.synthesizeResponse([result], message, context)
  }

  /**
   * Handle complex queries (multiple agents in parallel)
   */
  async handleComplexQuery(message, intent, context) {
    this.log('INFO', 'Executing complex multi-agent query', { agents: intent.agents })

    // Get all required agents
    const agents = intent.agents
      .map(name => this.agentRegistry.getAgent(name))
      .filter(agent => agent !== null)

    if (agents.length === 0) {
      throw new Error('No valid agents found for this task')
    }

    // Execute agents in parallel
    const results = await Promise.allSettled(
      agents.map(agent =>
        agent.execute({
          message,
          intent,
          context
        })
      )
    )

    // Extract successful results
    const successfulResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)

    // Log any failures
    results
      .filter(r => r.status === 'rejected')
      .forEach(r => {
        this.log('ERROR', 'Agent execution failed', { error: r.reason })
      })

    // Synthesize final response
    return await this.synthesizeResponse(successfulResults, message, context)
  }

  /**
   * Synthesize final response from agent results
   */
  async synthesizeResponse(agentResults, originalMessage, context) {
    const systemPrompt = `You are Quendoo AI, an intelligent hotel management assistant.

Synthesize a coherent, helpful response based on the results from specialized agents.

Guidelines:
- Be concise but informative
- Use the user's language (${context.language})
- Include specific numbers and data points
- Format with markdown for readability
- Add actionable recommendations
- Be professional but friendly

Agent results:
${JSON.stringify(agentResults, null, 2)}`

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Original user message: "${originalMessage}"\n\nPlease synthesize a response based on the agent results.`
        }
      ]
    })

    return {
      content: response.content[0].text,
      agentResults, // Include raw agent data for debugging
      usage: response.usage
    }
  }

  /**
   * Store conversation in memory for context
   */
  storeConversation(conversationId, message, response) {
    if (!this.conversationMemory.has(conversationId)) {
      this.conversationMemory.set(conversationId, [])
    }

    this.conversationMemory.get(conversationId).push({
      message,
      response,
      timestamp: new Date()
    })

    // Keep only last 10 interactions
    const history = this.conversationMemory.get(conversationId)
    if (history.length > 10) {
      this.conversationMemory.set(conversationId, history.slice(-10))
    }
  }

  /**
   * Get conversation context
   */
  getConversationContext(conversationId) {
    return this.conversationMemory.get(conversationId) || []
  }
}
