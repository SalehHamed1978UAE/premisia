import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

/**
 * Initialize Neo4j driver connection
 */
export function initializeNeo4j(config: Neo4jConfig): Driver {
  if (driver) {
    return driver;
  }

  driver = neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.username, config.password),
    {
      maxConnectionLifetime: 30 * 60 * 1000, // 30 minutes
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 60 * 1000, // 60 seconds
    }
  );

  console.log('[Neo4j] Driver initialized');
  return driver;
}

/**
 * Get Neo4j driver instance
 */
export function getDriver(): Driver {
  if (!driver) {
    // Initialize with environment variables
    const config: Neo4jConfig = {
      uri: process.env.NEO4J_URI || '',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || '',
      database: process.env.NEO4J_DATABASE || 'neo4j',
    };

    if (!config.uri || !config.password) {
      throw new Error('Neo4j configuration is missing. Set NEO4J_URI and NEO4J_PASSWORD environment variables.');
    }

    driver = initializeNeo4j(config);
  }

  return driver;
}

/**
 * Create a new Neo4j session
 */
export function createSession(database?: string): Session {
  const db = database || process.env.NEO4J_DATABASE || 'neo4j';
  return getDriver().session({ database: db });
}

/**
 * Close Neo4j driver connection
 */
export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    console.log('[Neo4j] Driver closed');
  }
}

/**
 * Verify Neo4j connection
 */
export async function verifyConnection(): Promise<boolean> {
  const session = createSession();
  try {
    await session.run('RETURN 1');
    console.log('[Neo4j] Connection verified');
    return true;
  } catch (error) {
    console.error('[Neo4j] Connection failed:', error);
    return false;
  } finally {
    await session.close();
  }
}
