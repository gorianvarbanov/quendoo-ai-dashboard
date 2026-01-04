/**
 * Google Cloud Secret Manager Integration
 * Handles secure storage and retrieval of API keys
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'quendoo-ai-dashboard';

// Secret names
export const SECRET_NAMES = {
  ANTHROPIC_API_KEY: 'anthropic-api-key',
  ADMIN_PASSWORD: 'admin-password',
  JWT_SECRET: 'jwt-secret'
};

/**
 * Get the latest version of a secret
 * @param {string} secretName - Name of the secret
 * @returns {Promise<string>} The secret value
 */
export async function getSecret(secretName) {
  try {
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    return payload;
  } catch (error) {
    console.error(`[Secret Manager] Failed to get secret ${secretName}:`, error.message);
    throw error;
  }
}

/**
 * Create or update a secret
 * @param {string} secretName - Name of the secret
 * @param {string} secretValue - Value to store
 * @returns {Promise<string>} The version name
 */
export async function createOrUpdateSecret(secretName, secretValue) {
  try {
    const parent = `projects/${projectId}`;
    const secretPath = `${parent}/secrets/${secretName}`;

    // Try to get the secret to see if it exists
    let secretExists = false;
    try {
      await client.getSecret({ name: secretPath });
      secretExists = true;
    } catch (error) {
      // Secret doesn't exist, we'll create it
      if (error.code !== 5) { // 5 = NOT_FOUND
        throw error;
      }
    }

    // Create secret if it doesn't exist
    if (!secretExists) {
      console.log(`[Secret Manager] Creating secret: ${secretName}`);
      await client.createSecret({
        parent,
        secretId: secretName,
        secret: {
          replication: {
            automatic: {},
          },
        },
      });
    }

    // Add new version with the secret value
    console.log(`[Secret Manager] Adding new version to secret: ${secretName}`);
    const [version] = await client.addSecretVersion({
      parent: secretPath,
      payload: {
        data: Buffer.from(secretValue, 'utf8'),
      },
    });

    return version.name;
  } catch (error) {
    console.error(`[Secret Manager] Failed to create/update secret ${secretName}:`, error.message);
    throw error;
  }
}

/**
 * Delete a secret (mark as disabled)
 * @param {string} secretName - Name of the secret
 */
export async function disableSecret(secretName) {
  try {
    const name = `projects/${projectId}/secrets/${secretName}`;

    // We'll add an empty version to effectively disable the secret
    // Or we could delete it entirely, but keeping history is safer
    await createOrUpdateSecret(secretName, 'your-api-key-here');

    console.log(`[Secret Manager] Secret disabled: ${secretName}`);
  } catch (error) {
    console.error(`[Secret Manager] Failed to disable secret ${secretName}:`, error.message);
    throw error;
  }
}

/**
 * Check if a secret exists and is configured
 * @param {string} secretName - Name of the secret
 * @returns {Promise<boolean>} True if secret exists and has valid value
 */
export async function isSecretConfigured(secretName) {
  try {
    const value = await getSecret(secretName);
    return value && value !== 'your-api-key-here' && value.length > 20;
  } catch (error) {
    if (error.code === 5) { // NOT_FOUND
      return false;
    }
    throw error;
  }
}

/**
 * Get masked version of secret for display
 * @param {string} secretName - Name of the secret
 * @returns {Promise<string|null>} Masked secret value or null
 */
export async function getMaskedSecret(secretName) {
  try {
    const value = await getSecret(secretName);
    if (!value || value === 'your-api-key-here' || value.length < 20) {
      return null;
    }
    return `${value.substring(0, 12)}...${value.substring(value.length - 4)}`;
  } catch (error) {
    return null;
  }
}

export default {
  getSecret,
  createOrUpdateSecret,
  disableSecret,
  isSecretConfigured,
  getMaskedSecret
};
