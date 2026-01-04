/**
 * Admin API Routes
 * Endpoints for managing security rules, configuration, and API keys
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to validation config file
const VALIDATION_CONFIG_PATH = path.join(__dirname, '../security/validationConfig.js');

// Path to .env file (go up to project root)
const ENV_FILE_PATH = path.join(__dirname, '../../.env');

/**
 * GET /admin/security/config
 * Get current security configuration
 */
router.get('/security/config', async (req, res) => {
  try {
    // Dynamically import to get latest config
    const configModule = await import(`../security/validationConfig.js?${Date.now()}`);
    const config = configModule.VALIDATION_CONFIG;

    res.json({
      success: true,
      config: {
        input: {
          maxLength: config.input.maxLength,
          allowControlCharacters: config.input.allowControlCharacters,
          injectionPatterns: config.input.injectionPatterns.map(p => p.source),
          offTopicKeywords: config.input.offTopicKeywords,
          hotelKeywords: config.input.hotelKeywords
        },
        output: {
          offTopicIndicators: config.output.offTopicIndicators,
          jailbreakIndicators: config.output.jailbreakIndicators,
          sensitivePatterns: config.output.sensitivePatterns.map(p => ({
            pattern: p.pattern.source,
            replacement: p.replacement,
            name: p.name
          }))
        },
        tools: {
          disabledTools: config.tools.disabledTools,
          parameterRules: Object.keys(config.tools.parameterRules)
        },
        rateLimits: config.rateLimits
      }
    });
  } catch (error) {
    console.error('Error reading security config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read security configuration'
    });
  }
});

/**
 * POST /admin/security/injection-patterns/add
 * Add a new injection pattern
 */
router.post('/security/injection-patterns/add', async (req, res) => {
  try {
    const { pattern, flags = 'i' } = req.body;

    if (!pattern) {
      return res.status(400).json({
        success: false,
        error: 'Pattern is required'
      });
    }

    // Read current config file
    let configContent = await fs.readFile(VALIDATION_CONFIG_PATH, 'utf-8');

    // Find the injectionPatterns array and add new pattern
    const patternToAdd = `      /${pattern}/${flags},`;

    // Insert before the closing bracket of injectionPatterns
    const injectionPatternsMatch = configContent.match(/injectionPatterns: \[([\s\S]*?)\]/);
    if (injectionPatternsMatch) {
      const currentPatterns = injectionPatternsMatch[1];
      const newPatterns = currentPatterns.trimEnd() + '\n' + patternToAdd;
      configContent = configContent.replace(
        /injectionPatterns: \[([\s\S]*?)\]/,
        `injectionPatterns: [${newPatterns}\n    ]`
      );
    }

    // Write updated config
    await fs.writeFile(VALIDATION_CONFIG_PATH, configContent, 'utf-8');

    res.json({
      success: true,
      message: 'Injection pattern added successfully'
    });
  } catch (error) {
    console.error('Error adding injection pattern:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add injection pattern'
    });
  }
});

/**
 * POST /admin/security/off-topic-keywords/add
 * Add off-topic keywords to a category
 */
router.post('/security/off-topic-keywords/add', async (req, res) => {
  try {
    const { category, keywords } = req.body;

    if (!category || !keywords || !Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        error: 'Category and keywords array are required'
      });
    }

    let configContent = await fs.readFile(VALIDATION_CONFIG_PATH, 'utf-8');

    // Find the category and add keywords
    const categoryPattern = new RegExp(`${category}: \\[(.*?)\\]`, 's');
    const match = configContent.match(categoryPattern);

    if (match) {
      // Existing category - add keywords to it
      const currentKeywords = match[1];
      const keywordsToAdd = keywords.map(kw => `'${kw}'`).join(', ');
      const newKeywords = currentKeywords.trim().replace(/\]$/, '') + `,\n        ${keywordsToAdd}`;

      configContent = configContent.replace(
        categoryPattern,
        `${category}: [${newKeywords}\n      ]`
      );

      await fs.writeFile(VALIDATION_CONFIG_PATH, configContent, 'utf-8');

      res.json({
        success: true,
        message: `Keywords added to ${category} category`
      });
    } else {
      // New category - create it in the offTopicKeywords object
      const keywordsToAdd = keywords.map(kw => `'${kw}'`).join(', ');
      const newCategoryEntry = `      ${category}: [\n        ${keywordsToAdd}\n      ],`;

      // Find the offTopicKeywords object and add the new category before the closing brace
      const offTopicPattern = /offTopicKeywords: \{([^}]*)\}/s;
      const offTopicMatch = configContent.match(offTopicPattern);

      if (offTopicMatch) {
        const currentCategories = offTopicMatch[1];
        const newCategories = currentCategories.trimEnd() + '\n' + newCategoryEntry;
        configContent = configContent.replace(
          offTopicPattern,
          `offTopicKeywords: {${newCategories}\n    }`
        );

        await fs.writeFile(VALIDATION_CONFIG_PATH, configContent, 'utf-8');

        res.json({
          success: true,
          message: `Category '${category}' created with keywords`
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Could not find offTopicKeywords structure in config'
        });
      }
    }
  } catch (error) {
    console.error('Error adding off-topic keywords:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add keywords'
    });
  }
});

/**
 * POST /admin/security/hotel-keywords/add
 * Add hotel-related keywords
 */
router.post('/security/hotel-keywords/add', async (req, res) => {
  try {
    const { keywords } = req.body;

    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        error: 'Keywords array is required'
      });
    }

    let configContent = await fs.readFile(VALIDATION_CONFIG_PATH, 'utf-8');

    // Find hotelKeywords array and add new keywords
    const hotelKeywordsPattern = /hotelKeywords: \[(.*?)\]/s;
    const match = configContent.match(hotelKeywordsPattern);

    if (match) {
      const currentKeywords = match[1];
      const keywordsToAdd = keywords.map(kw => `'${kw}'`).join(', ');
      const newKeywords = currentKeywords.trim().replace(/\]$/, '') + `,\n      ${keywordsToAdd}`;

      configContent = configContent.replace(
        hotelKeywordsPattern,
        `hotelKeywords: [${newKeywords}\n    ]`
      );

      await fs.writeFile(VALIDATION_CONFIG_PATH, configContent, 'utf-8');

      res.json({
        success: true,
        message: 'Hotel keywords added successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'hotelKeywords array not found'
      });
    }
  } catch (error) {
    console.error('Error adding hotel keywords:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add hotel keywords'
    });
  }
});

/**
 * PUT /admin/security/rate-limits
 * Update rate limiting settings
 */
router.put('/security/rate-limits', async (req, res) => {
  try {
    const { maxMessagesPerMinute, perToolLimits } = req.body;

    let configContent = await fs.readFile(VALIDATION_CONFIG_PATH, 'utf-8');

    // Update maxMessagesPerMinute
    if (maxMessagesPerMinute !== undefined) {
      configContent = configContent.replace(
        /maxMessagesPerMinute: \d+/,
        `maxMessagesPerMinute: ${maxMessagesPerMinute}`
      );
    }

    // Update perToolLimits if provided
    if (perToolLimits && typeof perToolLimits === 'object') {
      for (const [tool, limit] of Object.entries(perToolLimits)) {
        const toolPattern = new RegExp(`'${tool}': \\d+`);
        if (toolPattern.test(configContent)) {
          configContent = configContent.replace(toolPattern, `'${tool}': ${limit}`);
        }
      }
    }

    await fs.writeFile(VALIDATION_CONFIG_PATH, configContent, 'utf-8');

    res.json({
      success: true,
      message: 'Rate limits updated successfully'
    });
  } catch (error) {
    console.error('Error updating rate limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rate limits'
    });
  }
});

/**
 * POST /admin/security/tools/disable
 * Disable a tool
 */
router.post('/security/tools/disable', async (req, res) => {
  try {
    const { toolName } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }

    let configContent = await fs.readFile(VALIDATION_CONFIG_PATH, 'utf-8');

    // Find disabledTools array and add tool
    const disabledToolsPattern = /disabledTools: \[(.*?)\]/s;
    const match = configContent.match(disabledToolsPattern);

    if (match) {
      const currentTools = match[1].trim();

      // Check if tool is already disabled
      if (currentTools.includes(`'${toolName}'`)) {
        return res.json({
          success: true,
          message: 'Tool is already disabled'
        });
      }

      const toolToAdd = `'${toolName}'`;
      const newTools = currentTools ? `${currentTools},\n      ${toolToAdd}` : `\n      ${toolToAdd}\n    `;

      configContent = configContent.replace(
        disabledToolsPattern,
        `disabledTools: [${newTools}]`
      );

      await fs.writeFile(VALIDATION_CONFIG_PATH, configContent, 'utf-8');

      res.json({
        success: true,
        message: `Tool '${toolName}' disabled successfully`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'disabledTools array not found'
      });
    }
  } catch (error) {
    console.error('Error disabling tool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable tool'
    });
  }
});

/**
 * POST /admin/security/tools/enable
 * Enable a previously disabled tool
 */
router.post('/security/tools/enable', async (req, res) => {
  try {
    const { toolName } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }

    let configContent = await fs.readFile(VALIDATION_CONFIG_PATH, 'utf-8');

    // Remove tool from disabledTools array
    configContent = configContent.replace(
      new RegExp(`[\\s]*'${toolName}'[,]?`, 'g'),
      ''
    );

    await fs.writeFile(VALIDATION_CONFIG_PATH, configContent, 'utf-8');

    res.json({
      success: true,
      message: `Tool '${toolName}' enabled successfully`
    });
  } catch (error) {
    console.error('Error enabling tool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable tool'
    });
  }
});

/**
 * GET /admin/security/stats
 * Get security statistics from all validators
 */
router.get('/security/stats', async (req, res) => {
  try {
    // Import validators to get stats
    const { inputValidator } = await import('../index.js');
    const { outputFilter } = await import('../index.js');
    const { toolValidator } = await import('../index.js');
    const { securityMonitor } = await import('../index.js');

    const stats = {
      monitor: securityMonitor?.getStats() || {},
      inputValidator: inputValidator?.getStats() || {},
      outputFilter: outputFilter?.getStats() || {},
      toolValidator: toolValidator?.getStats() || {}
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting security stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security statistics'
    });
  }
});

/**
 * GET /admin/security/events
 * Get recent security events
 */
router.get('/security/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const { securityMonitor } = await import('../index.js');
    const events = securityMonitor?.getRecentEvents(limit) || [];

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error getting security events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security events'
    });
  }
});

/**
 * GET /admin/api-key/status
 * Check if Anthropic API key is configured
 */
router.get('/api-key/status', (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const isConfigured = apiKey && apiKey !== 'your-api-key-here' && apiKey.length > 20;

    res.json({
      success: true,
      configured: isConfigured,
      maskedKey: isConfigured ? `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}` : null
    });
  } catch (error) {
    console.error('Error checking API key status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check API key status'
    });
  }
});

/**
 * PUT /admin/api-key/update
 * Update Anthropic API key in .env file
 * Body: { apiKey }
 */
router.put('/api-key/update', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required'
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-ant-') || apiKey.length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Anthropic API key format. Key should start with "sk-ant-"'
      });
    }

    // Read current .env file
    let envContent = await fs.readFile(ENV_FILE_PATH, 'utf-8');

    // Update ANTHROPIC_API_KEY line
    if (envContent.includes('ANTHROPIC_API_KEY=')) {
      envContent = envContent.replace(
        /ANTHROPIC_API_KEY=.*/,
        `ANTHROPIC_API_KEY=${apiKey}`
      );
    } else {
      // Add it if it doesn't exist
      envContent += `\nANTHROPIC_API_KEY=${apiKey}\n`;
    }

    // Write updated .env file
    await fs.writeFile(ENV_FILE_PATH, envContent, 'utf-8');

    // Update process.env
    process.env.ANTHROPIC_API_KEY = apiKey;

    // Reinitialize Claude integration in main server
    const { reinitializeClaudeIntegration } = await import('../index.js');
    if (reinitializeClaudeIntegration) {
      reinitializeClaudeIntegration();
    }

    console.log('[Admin] Anthropic API key updated successfully');

    res.json({
      success: true,
      message: 'API key updated successfully',
      configured: true,
      maskedKey: `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}`
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API key'
    });
  }
});

/**
 * DELETE /admin/api-key/remove
 * Remove Anthropic API key
 */
router.delete('/api-key/remove', async (req, res) => {
  try {
    // Read current .env file
    let envContent = await fs.readFile(ENV_FILE_PATH, 'utf-8');

    // Update ANTHROPIC_API_KEY to placeholder
    envContent = envContent.replace(
      /ANTHROPIC_API_KEY=.*/,
      'ANTHROPIC_API_KEY=your-api-key-here'
    );

    // Write updated .env file
    await fs.writeFile(ENV_FILE_PATH, envContent, 'utf-8');

    // Update process.env
    process.env.ANTHROPIC_API_KEY = 'your-api-key-here';

    // Reinitialize Claude integration
    const { reinitializeClaudeIntegration } = await import('../index.js');
    if (reinitializeClaudeIntegration) {
      reinitializeClaudeIntegration();
    }

    console.log('[Admin] Anthropic API key removed');

    res.json({
      success: true,
      message: 'API key removed successfully',
      configured: false
    });
  } catch (error) {
    console.error('Error removing API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove API key'
    });
  }
});

export default router;
