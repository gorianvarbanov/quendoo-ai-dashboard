/**
 * [AGENT_NAME] Agent Template
 *
 * PURPOSE: [Brief description of what this agent does]
 *
 * CAPABILITIES:
 * - [Capability 1]
 * - [Capability 2]
 * - [Capability 3]
 *
 * MODEL: [claude-haiku for simple tasks, claude-sonnet for complex]
 */

import Anthropic from '@anthropic-ai/sdk'
import { BaseAgent } from './BaseAgent.js'
import admin from 'firebase-admin'

export class [AgentName]Agent extends BaseAgent {
  constructor() {
    // Choose model based on complexity:
    // - 'claude-haiku-3-5-20241022' for simple, cost-effective tasks
    // - 'claude-sonnet-4-20250514' for complex reasoning
    super('[AgentName]', 'claude-haiku-3-5-20241022')

    // Define what this agent can do
    this.capabilities = [
      'capability_1',
      'capability_2',
      'capability_3'
    ]

    // Define data access permissions
    this.permissions = {
      read: ['resource1', 'resource2'],   // What it can read
      write: ['resource1'],                // What it can modify
      delete: []                           // What it can delete (usually empty)
    }

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    // Initialize Firestore
    this.db = admin.firestore()
  }

  /**
   * Main execution method
   * This is called by the orchestrator
   *
   * @param {Object} params
   * @param {string} params.message - User's message
   * @param {Object} params.intent - Analyzed intent from orchestrator
   * @param {Object} params.context - Context (hotelId, language, etc.)
   * @returns {Object} Result with agent name, data, and analysis
   */
  async execute({ message, intent, context }) {
    try {
      this.log('INFO', 'Executing task', { message })

      // STEP 1: Determine specific task type
      const taskType = await this.determineTaskType(message)
      this.log('INFO', 'Task type determined', { taskType })

      // STEP 2: Validate permissions (if needed)
      // this.validatePermissions('read', 'resource_name')

      // STEP 3: Fetch required data
      const data = await this.fetchData(taskType, context)
      this.log('INFO', 'Data fetched', { dataSize: JSON.stringify(data).length })

      // STEP 4: Process/analyze data
      const result = await this.processData(data, message, context)
      this.log('INFO', 'Processing complete')

      // STEP 5: Return structured result
      return {
        agent: this.name,
        taskType,
        data,
        result,
        success: true
      }

    } catch (error) {
      this.log('ERROR', 'Execution failed', { error: error.message })
      return {
        agent: this.name,
        error: error.message,
        success: false
      }
    }
  }

  /**
   * Determine specific task type from user message
   *
   * @param {string} message - User's message
   * @returns {string} Task type
   */
  async determineTaskType(message) {
    const lowerMessage = message.toLowerCase()

    // Add your task detection logic
    if (lowerMessage.includes('keyword1')) {
      return 'task_type_1'
    } else if (lowerMessage.includes('keyword2')) {
      return 'task_type_2'
    } else {
      return 'default_task'
    }
  }

  /**
   * Fetch data from Firestore or external APIs
   *
   * @param {string} taskType - Type of task
   * @param {Object} context - Context with hotelId, etc.
   * @returns {Object} Fetched data
   */
  async fetchData(taskType, context) {
    const { hotelId } = context
    const data = {}

    try {
      switch (taskType) {
        case 'task_type_1':
          // Example: Fetch from Firestore
          data.items = await this.fetchItems(hotelId)
          break

        case 'task_type_2':
          // Example: Call external API
          data.external = await this.callExternalAPI(hotelId)
          break

        default:
          // Default data fetch
          data.default = await this.fetchDefaultData(hotelId)
      }

      return data

    } catch (error) {
      this.log('ERROR', 'Data fetch failed', { error: error.message })
      throw error
    }
  }

  /**
   * Process/analyze data using Claude or custom logic
   *
   * @param {Object} data - Fetched data
   * @param {string} originalMessage - User's original message
   * @param {Object} context - Context
   * @returns {string} Analysis result
   */
  async processData(data, originalMessage, context) {
    // Option 1: Use Claude for analysis
    return await this.analyzeWithClaude(data, originalMessage, context)

    // Option 2: Use custom logic
    // return this.customAnalysis(data)
  }

  /**
   * Analyze data using Claude
   *
   * @param {Object} data - Data to analyze
   * @param {string} message - User's message
   * @param {Object} context - Context
   * @returns {string} Claude's analysis
   */
  async analyzeWithClaude(data, message, context) {
    const systemPrompt = `You are a specialized [DOMAIN] expert for hotel management.

Your role is to:
- [Role description 1]
- [Role description 2]
- [Role description 3]

Respond in ${context.language}.

Guidelines:
- Be specific with numbers and data
- Provide actionable recommendations
- Use clear, professional language
- Format with markdown for readability`

    const dataStr = JSON.stringify(data, null, 2)

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `User question: "${message}"\n\nData:\n${dataStr}\n\nProvide analysis.`
        }
      ]
    })

    return response.content[0].text
  }

  /**
   * Custom analysis logic (alternative to Claude)
   *
   * @param {Object} data - Data to analyze
   * @returns {Object} Analysis result
   */
  customAnalysis(data) {
    // Implement your custom logic here
    return {
      summary: 'Analysis summary',
      insights: [],
      recommendations: []
    }
  }

  /**
   * Example: Fetch items from Firestore
   */
  async fetchItems(hotelId) {
    const snapshot = await this.db
      .collection('items')
      .where('hotelId', '==', hotelId)
      .limit(100)
      .get()

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  }

  /**
   * Example: Call external API
   */
  async callExternalAPI(hotelId) {
    // Implement external API call
    // const response = await fetch(`https://api.example.com/data/${hotelId}`)
    // return await response.json()

    throw new Error('External API not implemented')
  }

  /**
   * Example: Fetch default data
   */
  async fetchDefaultData(hotelId) {
    // Implement default data fetching
    return {
      hotelId,
      timestamp: new Date()
    }
  }
}

/**
 * USAGE EXAMPLE:
 *
 * 1. Create your agent file (copy this template)
 * 2. Replace [AgentName] with your agent name (e.g., Revenue, Marketing)
 * 3. Implement the required methods
 * 4. Register in AgentRegistry:
 *
 *    import { YourAgent } from './YourAgent.js'
 *    this.registerAgent('your-agent', new YourAgent())
 *
 * 5. Test directly:
 *
 *    curl -X POST http://localhost:8080/api/agents/direct/your-agent \
 *      -H "Authorization: Bearer TOKEN" \
 *      -d '{"message": "Test message"}'
 *
 * 6. Once tested, orchestrator will automatically use it
 */
