/**
 * Base Agent Class
 * All specialized agents extend this base class
 */

export class BaseAgent {
  constructor(name, model = 'claude-haiku-3-5-20241022') {
    this.name = name
    this.model = model
    this.capabilities = []
    this.permissions = { read: [], write: [], delete: [] }
  }

  /**
   * Main execution method - override in child classes
   */
  async execute(task, context) {
    throw new Error('execute() must be implemented by child class')
  }

  /**
   * Check if agent can handle this task
   */
  canHandle(task) {
    return this.capabilities.some(cap => task.type === cap)
  }

  /**
   * Validate permissions before execution
   */
  validatePermissions(action, resource) {
    if (!this.permissions[action]) {
      throw new Error(`Agent ${this.name} does not have ${action} permission`)
    }

    if (!this.permissions[action].includes(resource)) {
      throw new Error(`Agent ${this.name} cannot ${action} ${resource}`)
    }

    return true
  }

  /**
   * Log agent activity
   */
  log(level, message, data = {}) {
    console.log(`[${this.name}] [${level}]`, message, data)
  }

  /**
   * Handle errors
   */
  handleError(error) {
    this.log('ERROR', error.message, { stack: error.stack })
    throw error
  }
}
