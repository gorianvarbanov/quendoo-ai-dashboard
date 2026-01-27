/**
 * Multi-Agent API Routes
 * Endpoints for the multi-agent system
 */

import express from 'express'
import { agentRegistry } from '../services/agents/AgentRegistry.js'

const router = express.Router()

/**
 * Initialize agents on server startup
 */
agentRegistry.initialize().catch(error => {
  console.error('[MultiAgent] Failed to initialize agents:', error)
})

/**
 * POST /api/agents/chat
 * Main chat endpoint using multi-agent orchestration
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body
    const hotelId = req.hotelId // From auth middleware
    const language = req.body.language || 'en'

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      })
    }

    // Get orchestrator
    const orchestrator = agentRegistry.getOrchestrator()

    // Build context
    const context = {
      hotelId,
      language,
      conversationId,
      timestamp: new Date()
    }

    // Execute with orchestrator
    const result = await orchestrator.execute(message, context)

    // Store conversation history
    if (conversationId) {
      orchestrator.storeConversation(conversationId, message, result)
    }

    res.json({
      success: true,
      response: result.content,
      metadata: {
        agentResults: result.agentResults,
        usage: result.usage
      }
    })

  } catch (error) {
    console.error('[MultiAgent] Chat error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/agents/status
 * Get agent system status and health
 */
router.get('/status', async (req, res) => {
  try {
    const stats = agentRegistry.getStats()
    const health = await agentRegistry.healthCheck()

    res.json({
      success: true,
      stats,
      health
    })

  } catch (error) {
    console.error('[MultiAgent] Status error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/agents/list
 * List all available agents and their capabilities
 */
router.get('/list', (req, res) => {
  try {
    const agents = agentRegistry.getAllAgents()

    res.json({
      success: true,
      agents
    })

  } catch (error) {
    console.error('[MultiAgent] List error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/agents/direct/:agentName
 * Call a specific agent directly (for testing/debugging)
 */
router.post('/direct/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params
    const { message } = req.body
    const hotelId = req.hotelId
    const language = req.body.language || 'en'

    const agent = agentRegistry.getAgent(agentName)

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: `Agent ${agentName} not found`
      })
    }

    const context = {
      hotelId,
      language,
      timestamp: new Date()
    }

    const result = await agent.execute({
      message,
      context
    })

    res.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('[MultiAgent] Direct call error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/agents/conversation/:conversationId/history
 * Get conversation history from orchestrator memory
 */
router.get('/conversation/:conversationId/history', (req, res) => {
  try {
    const { conversationId } = req.params
    const orchestrator = agentRegistry.getOrchestrator()

    const history = orchestrator.getConversationContext(conversationId)

    res.json({
      success: true,
      history
    })

  } catch (error) {
    console.error('[MultiAgent] History error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
