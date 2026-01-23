export const config = {
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
    timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.API_RETRIES || '3', 10),
  },

  crewai: {
    serviceUrl: process.env.CREWAI_SERVICE_URL || 'http://localhost:8001',
    healthCheckInterval: parseInt(process.env.CREWAI_HEALTH_INTERVAL || '30000', 10),
    generationTimeout: parseInt(process.env.CREWAI_TIMEOUT || '300000', 10),
  },

  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },

  features: {
    useMultiAgentEPM: process.env.USE_MULTI_AGENT_EPM === 'true',
    intelligentPlanningEnabled: process.env.INTELLIGENT_PLANNING_ENABLED === 'true',
    epmFallbackOnError: process.env.EPM_FALLBACK_ON_ERROR === 'true',
  },

  limits: {
    maxFileSize: 50 * 1024 * 1024,
    maxPlanningIterations: parseInt(process.env.MAX_PLANNING_ITERATIONS || '10', 10),
    targetPlanningScore: parseFloat(process.env.TARGET_PLANNING_SCORE || '0.85'),
  },

  encryption: {
    keyId: process.env.AWS_KMS_KEY_ID,
    region: process.env.AWS_REGION || 'us-east-1',
  },

  contextFoundry: {
    apiUrl: process.env.CONTEXT_FOUNDRY_API_URL,
    apiKey: process.env.CONTEXT_FOUNDRY_API_KEY,
  },
} as const;

export type Config = typeof config;
