/**
 * Agent Registry
 * Central registry for all specialized agents
 */

import { OrchestratorAgent } from './OrchestratorAgent.js'
import { AnalyticsAgent } from './AnalyticsAgent.js'
// Import other agents as they are created
// import { RevenueAgent } from './RevenueAgent.js'
// import { RatesAgent } from './RatesAgent.js'
// import { MarketingAgent } from './MarketingAgent.js'
// etc.

export class AgentRegistry {
  constructor() {
    this.agents = new Map()
    this.orchestrator = null
    this.initialized = false
  }

  /**
   * Initialize all agents
   */
  async initialize() {
    if (this.initialized) {
      console.log('[AgentRegistry] Already initialized')
      return
    }

    console.log('[AgentRegistry] Initializing agents...')

    try {
      // Register specialized agents first
      this.registerAgent('analytics', new AnalyticsAgent())

      // TODO: Register other agents as they are created
      // this.registerAgent('revenue', new RevenueAgent())
      // this.registerAgent('rates', new RatesAgent())
      // this.registerAgent('marketing', new MarketingAgent())
      // this.registerAgent('troubleshooting', new TroubleshootingAgent())
      // this.registerAgent('operations', new OperationsAgent())
      // this.registerAgent('intelligence', new IntelligenceAgent())
      // this.registerAgent('guests', new GuestAgent())
      // this.registerAgent('automation', new AutomationAgent())

      // Create orchestrator last (needs reference to registry)
      this.orchestrator = new OrchestratorAgent(this)

      this.initialized = true
      console.log(`[AgentRegistry] Initialized with ${this.agents.size} agents`)

    } catch (error) {
      console.error('[AgentRegistry] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Register a new agent
   */
  registerAgent(name, agent) {
    if (this.agents.has(name)) {
      console.warn(`[AgentRegistry] Agent ${name} already registered, overwriting`)
    }

    this.agents.set(name, agent)
    console.log(`[AgentRegistry] Registered agent: ${name}`)
  }

  /**
   * Get agent by name
   */
  getAgent(name) {
    const agent = this.agents.get(name)

    if (!agent) {
      console.warn(`[AgentRegistry] Agent ${name} not found`)
      return null
    }

    return agent
  }

  /**
   * Get orchestrator
   */
  getOrchestrator() {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized')
    }

    return this.orchestrator
  }

  /**
   * Get all registered agents
   */
  getAllAgents() {
    return Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      model: agent.model,
      capabilities: agent.capabilities
    }))
  }

  /**
   * Check if agent exists
   */
  hasAgent(name) {
    return this.agents.has(name)
  }

  /**
   * Get agent stats
   */
  getStats() {
    return {
      totalAgents: this.agents.size,
      agents: this.getAllAgents(),
      orchestratorModel: this.orchestrator?.model || 'not initialized'
    }
  }

  /**
   * Health check for all agents
   */
  async healthCheck() {
    const results = {}

    // Check orchestrator
    results.orchestrator = {
      status: this.orchestrator ? 'healthy' : 'not initialized',
      model: this.orchestrator?.model
    }

    // Check each agent
    for (const [name, agent] of this.agents.entries()) {
      results[name] = {
        status: 'healthy',
        model: agent.model,
        capabilities: agent.capabilities.length
      }
    }

    return results
  }
}

// Create singleton instance
export const agentRegistry = new AgentRegistry()
