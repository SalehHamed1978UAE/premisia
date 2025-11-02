/**
 * Test Fixtures
 * Helper functions to create test data with proper foreign key relationships
 */

import { db } from '../server/db';
import { 
  users, 
  strategicUnderstanding, 
  journeySessions, 
  strategicEntities, 
  references 
} from '@shared/schema';
import { encryptJSON } from '../server/utils/encryption';
import type { JourneyType } from '@shared/journey-types';
import { randomUUID } from 'crypto';

export interface TestUser {
  id: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
}

export interface TestUnderstanding {
  id: string;
  sessionId: string;
  userInput: string;
  title: string;
  archived: boolean;
  createdAt: Date;
}

export interface TestJourneySession {
  id: string;
  understandingId: string;
  userId: string;
  journeyType: JourneyType;
  status: string;
  versionNumber: number;
  accumulatedContext: any;
  summary: any;
}

export interface TestEntity {
  id: string;
  understandingId: string;
  type: string;
  claim: string;
  source: string;
  confidence: string;
  discoveredBy: string;
}

export interface TestReference {
  id: string;
  understandingId: string;
  userId: string;
  title: string;
  url: string;
  sourceType: string;
  origin: string;
}

/**
 * Create a test user
 * @param overrides - Optional field overrides
 * @returns Created user record
 */
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const timestamp = Date.now();
  const [user] = await db
    .insert(users)
    .values({
      id: overrides.id || `test-user-${timestamp}-${randomUUID().slice(0, 8)}`,
      email: overrides.email || `test-${timestamp}@example.com`,
      role: overrides.role || 'Viewer',
    })
    .returning();
  
  return user as TestUser;
}

/**
 * Create a test understanding (strategic understanding)
 * @param overrides - Optional field overrides
 * @returns Created understanding record
 */
export async function createTestUnderstanding(
  overrides: Partial<TestUnderstanding> = {}
): Promise<TestUnderstanding> {
  const timestamp = Date.now();
  const [understanding] = await db
    .insert(strategicUnderstanding)
    .values({
      sessionId: overrides.sessionId || `test-session-${timestamp}`,
      userInput: overrides.userInput || 'Test strategic input for testing',
      title: overrides.title || 'Test Strategy',
      archived: overrides.archived ?? false,
      createdAt: overrides.createdAt || new Date(),
    })
    .returning();
  
  return understanding as TestUnderstanding;
}

/**
 * Create a test journey session with proper encryption
 * @param understandingId - The understanding ID this session belongs to
 * @param userId - The user ID who owns this session
 * @param journeyType - The type of journey
 * @param overrides - Optional field overrides
 * @returns Created journey session record
 */
export async function createTestJourneySession(
  understandingId: string,
  userId: string,
  journeyType: JourneyType,
  overrides: Partial<TestJourneySession> = {}
): Promise<TestJourneySession> {
  const defaultContext = {
    journeyType,
    frameworks: [],
    insights: [],
  };

  const defaultSummary = {
    journeyType,
    completedAt: new Date().toISOString(),
    versionNumber: overrides.versionNumber || 1,
    keyInsights: ['Test insight 1', 'Test insight 2'],
    frameworks: { five_whys: {}, bmc: {} },
    strategicImplications: ['Implication 1', 'Implication 2'],
  };

  const [session] = await db
    .insert(journeySessions)
    .values({
      understandingId,
      userId,
      journeyType,
      status: (overrides.status as any) || 'initializing',
      versionNumber: overrides.versionNumber || 1,
      accumulatedContext: overrides.accumulatedContext || defaultContext,
      summary: overrides.summary || null,
      background: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  
  return session as unknown as TestJourneySession;
}

/**
 * Create a test strategic entity
 * @param understandingId - The understanding ID this entity belongs to
 * @param overrides - Optional field overrides
 * @returns Created entity record
 */
export async function createTestEntity(
  understandingId: string,
  overrides: Partial<TestEntity> = {}
): Promise<TestEntity> {
  const [entity] = await db
    .insert(strategicEntities)
    .values({
      understandingId,
      type: (overrides.type as any) || 'explicit_assumption',
      claim: overrides.claim || 'Test assumption claim',
      source: overrides.source || 'Test input',
      confidence: (overrides.confidence as any) || 'high',
      discoveredBy: (overrides.discoveredBy as any) || 'user_input',
    })
    .returning();
  
  return entity as TestEntity;
}

/**
 * Create a test reference
 * @param understandingId - The understanding ID this reference belongs to
 * @param userId - The user ID who created this reference
 * @param overrides - Optional field overrides
 * @returns Created reference record
 */
export async function createTestReference(
  understandingId: string,
  userId: string,
  overrides: Partial<TestReference> = {}
): Promise<TestReference> {
  const [reference] = await db
    .insert(references)
    .values({
      understandingId,
      userId,
      title: overrides.title || 'Test Reference',
      url: overrides.url || 'https://example.com',
      sourceType: (overrides.sourceType as any) || 'article',
      origin: (overrides.origin as any) || 'manual_entry',
    })
    .returning();
  
  return reference as TestReference;
}

/**
 * Create a complete test scenario with user, understanding, and optionally sessions
 * @param options - Configuration for what to create
 * @returns Object containing all created test data
 */
export async function createTestScenario(options: {
  includeSession?: boolean;
  journeyType?: JourneyType;
  sessionStatus?: string;
  includeEntities?: boolean;
  includeReferences?: boolean;
  entityCount?: number;
  referenceCount?: number;
} = {}) {
  const user = await createTestUser();
  const understanding = await createTestUnderstanding();
  
  const result: any = {
    user,
    understanding,
  };

  if (options.includeSession) {
    const session = await createTestJourneySession(
      understanding.id,
      user.id,
      options.journeyType || 'business_model_innovation',
      { status: options.sessionStatus }
    );
    result.session = session;
  }

  if (options.includeEntities) {
    const entityCount = options.entityCount || 1;
    result.entities = [];
    for (let i = 0; i < entityCount; i++) {
      const entity = await createTestEntity(understanding.id, {
        claim: `Test assumption ${i + 1}`,
      });
      result.entities.push(entity);
    }
  }

  if (options.includeReferences) {
    const referenceCount = options.referenceCount || 1;
    result.references = [];
    for (let i = 0; i < referenceCount; i++) {
      const reference = await createTestReference(understanding.id, user.id, {
        title: `Test Reference ${i + 1}`,
        url: `https://example.com/ref-${i + 1}`,
      });
      result.references.push(reference);
    }
  }

  return result;
}
