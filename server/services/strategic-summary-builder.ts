import { db } from '../db';
import { getStrategicUnderstanding } from './secure-data-service';

/**
 * Strategic Summary Builder
 * 
 * Builds concise strategic summaries for follow-on journeys using ONLY the latest
 * completed journey session. No multi-session aggregation.
 * 
 * Target size: < 8KB total
 */

interface StrategicSummary {
  summaryVersion: number;
  strategySnapshot: {
    baselineInput: string;
    title: string | null;
    currentGoal: string | null;
  };
  latestJourney: {
    journeySessionId: string;
    journeyType: string;
    completedAt: string;
    frameworks: {
      fiveWhys?: {
        rootCause: string;
        path: string[];
      };
      bmc?: {
        keyBlocks: Array<{
          blockType: string;
          finding: string;
        }>;
      };
    };
    keyDecisions: Array<{
      title: string;
      approach?: string;
    }>;
  } | null;
  supportingEvidence: Array<{
    title: string;
    url: string | null;
    confidence: number | null;
  }>;
  openItems: string[];
}

/**
 * Truncate text to max length
 */
function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Find the latest completed journey session for an understanding
 */
async function findLatestCompletedSession(understandingId: string) {
  const latestSession = await db.query.journeySessions.findFirst({
    where: (tbl, { eq, and }) => and(
      eq(tbl.understandingId, understandingId),
      eq(tbl.status, 'completed')
    ),
    orderBy: (tbl, { desc }) => desc(tbl.completedAt ?? tbl.createdAt),
  });

  return latestSession;
}

/**
 * Build strategic summary from the latest completed journey session
 */
export async function buildStrategicSummary(understandingId: string): Promise<string> {
  const startTime = Date.now();
  
  // Get the strategic understanding
  const understanding = await getStrategicUnderstanding(understandingId);
  if (!understanding) {
    throw new Error('Strategic understanding not found');
  }

  // Find latest completed journey session
  const latestSession = await findLatestCompletedSession(understandingId);
  
  // Build summary object
  const summary: StrategicSummary = {
    summaryVersion: 2,
    strategySnapshot: {
      // Truncate baseline input to 300 chars max (enforcing ≤300 char limit for all text fields)
      baselineInput: truncate(understanding.userInput, 300),
      title: understanding.title 
        ? truncate(understanding.title, 200) 
        : null,
      currentGoal: understanding.initiativeDescription
        ? truncate(understanding.initiativeDescription, 300)
        : null,
    },
    latestJourney: null,
    supportingEvidence: [],
    openItems: [],
  };

  // If no completed journey exists, return baseline only
  if (!latestSession) {
    console.log('[StrategicSummary] No completed journey found, using baseline input only');
    return formatSummaryAsMarkdown(summary);
  }

  // Extract data ONLY from the latest session
  summary.latestJourney = {
    journeySessionId: latestSession.id,
    journeyType: latestSession.journeyType,
    completedAt: (latestSession.completedAt ?? latestSession.createdAt)?.toISOString() || '',
    frameworks: {},
    keyDecisions: [],
  };

  // Get strategy versions from this session only
  const sessionVersions = await db.query.strategyVersions.findMany({
    where: (versions, { eq }) => eq(versions.sessionId, latestSession.id),
    orderBy: (versions, { desc }) => [desc(versions.createdAt)],
    limit: 1, // Only the latest version from this session
  });

  // Extract key decisions (max 5)
  if (sessionVersions.length > 0) {
    const version = sessionVersions[0];
    
    // Add approach if available
    if (version.strategicApproach) {
      summary.latestJourney.keyDecisions.push({
        title: 'Strategic Approach',
        approach: truncate(version.strategicApproach, 150),
      });
    }

    // Extract decisions from decisionsData
    if (version.decisionsData) {
      try {
        const decisions = typeof version.decisionsData === 'string'
          ? JSON.parse(version.decisionsData)
          : version.decisionsData;
        
        if (Array.isArray(decisions)) {
          decisions.slice(0, 4).forEach((d: any) => {
            if (d.title) {
              summary.latestJourney!.keyDecisions.push({
                title: truncate(d.title, 100),
                approach: d.approach ? truncate(d.approach, 150) : undefined,
              });
            }
          });
        }
      } catch (e) {
        console.warn('[StrategicSummary] Failed to parse decisionsData:', e);
      }
    }
  }

  // Limit to 5 decisions total
  summary.latestJourney.keyDecisions = summary.latestJourney.keyDecisions.slice(0, 5);

  // Extract Five Whys data if available
  const accumulatedContext = latestSession.accumulatedContext as any;
  if (accumulatedContext?.fiveWhys) {
    const fiveWhysData = accumulatedContext.fiveWhys;
    summary.latestJourney.frameworks.fiveWhys = {
      rootCause: truncate(fiveWhysData.rootCause || fiveWhysData.finalRootCause, 200),
      path: (fiveWhysData.selectedPath || [])
        .slice(0, 5)
        .map((p: string) => truncate(p, 100)),
    };
  }

  // Extract BMC data if available
  if (accumulatedContext?.bmc) {
    const bmcData = accumulatedContext.bmc;
    const keyBlocks: Array<{ blockType: string; finding: string }> = [];
    
    // Extract top 3 findings from BMC blocks
    const blockTypes = [
      'customer_segments',
      'value_propositions',
      'revenue_streams',
      'channels',
      'customer_relationships',
      'key_resources',
      'key_activities',
      'key_partnerships',
      'cost_structure'
    ];

    for (const blockType of blockTypes) {
      if (keyBlocks.length >= 3) break;
      
      const blockData = bmcData[blockType];
      if (blockData?.insights && Array.isArray(blockData.insights) && blockData.insights.length > 0) {
        keyBlocks.push({
          blockType,
          finding: truncate(blockData.insights[0], 150),
        });
      }
    }

    if (keyBlocks.length > 0) {
      summary.latestJourney.frameworks.bmc = { keyBlocks };
    }
  }

  // Get references from this session only (max 3, highest confidence)
  const sessionReferences = await db.query.references.findMany({
    where: (refs, { eq }) => eq(refs.sessionId, latestSession.id),
    orderBy: (refs, { desc }) => [desc(refs.confidence)],
    limit: 3,
  });

  summary.supportingEvidence = sessionReferences.map(ref => ({
    title: truncate(ref.title, 80),
    url: ref.url,
    confidence: ref.confidence ? parseFloat(ref.confidence) : null,
  }));

  // Get strategic entities from this understanding (max 5 most recent)
  const entities = await db.query.strategicEntities.findMany({
    where: (entities, { eq }) => eq(entities.understandingId, understandingId),
    orderBy: (entities, { desc }) => [desc(entities.createdAt)],
    limit: 5,
  });

  // Extract open items (risks, questions) - max 5
  summary.openItems = entities
    .filter(e => e.type === 'risk' || e.type === 'constraint')
    .slice(0, 5)
    .map(e => truncate(e.claim, 120));

  // Format as markdown and check size
  const markdownSummary = formatSummaryAsMarkdown(summary);
  const sizeInBytes = Buffer.byteLength(markdownSummary, 'utf8');
  const sizeInKB = (sizeInBytes / 1024).toFixed(2);
  
  const duration = Date.now() - startTime;
  console.log(`[StrategicSummary] Built summary in ${duration}ms - Size: ${sizeInKB} KB`);
  
  // LOUD WARNING if size exceeds 8KB
  if (sizeInBytes > 8192) {
    console.warn(`⚠️  [StrategicSummary] WARNING: Summary size ${sizeInKB} KB exceeds 8KB limit! This may cause token issues.`);
  }

  return markdownSummary;
}

/**
 * Format summary object as markdown
 */
function formatSummaryAsMarkdown(summary: StrategicSummary): string {
  const lines: string[] = [];

  lines.push('# Strategic Context Summary\n');
  
  // Baseline
  if (summary.strategySnapshot.title) {
    lines.push(`## ${summary.strategySnapshot.title}\n`);
  }
  
  lines.push('## Executive Summary');
  lines.push(summary.strategySnapshot.baselineInput);
  lines.push('');

  if (summary.strategySnapshot.currentGoal) {
    lines.push('## Current Goal');
    lines.push(summary.strategySnapshot.currentGoal);
    lines.push('');
  }

  // Latest journey
  if (summary.latestJourney) {
    lines.push('## Latest Analysis');
    lines.push(`**Journey Type:** ${summary.latestJourney.journeyType}`);
    lines.push(`**Completed:** ${summary.latestJourney.completedAt}`);
    lines.push('');

    // Five Whys
    if (summary.latestJourney.frameworks.fiveWhys) {
      lines.push('### Five Whys Root Cause');
      lines.push(summary.latestJourney.frameworks.fiveWhys.rootCause);
      if (summary.latestJourney.frameworks.fiveWhys.path.length > 0) {
        lines.push('**Path:** ' + summary.latestJourney.frameworks.fiveWhys.path.join(' → '));
      }
      lines.push('');
    }

    // BMC
    if (summary.latestJourney.frameworks.bmc) {
      lines.push('### Business Model Canvas Highlights');
      summary.latestJourney.frameworks.bmc.keyBlocks.forEach(block => {
        lines.push(`- **${block.blockType}:** ${block.finding}`);
      });
      lines.push('');
    }

    // Decisions
    if (summary.latestJourney.keyDecisions.length > 0) {
      lines.push('### Key Decisions');
      summary.latestJourney.keyDecisions.forEach((decision, idx) => {
        lines.push(`${idx + 1}. **${decision.title}**`);
        if (decision.approach) {
          lines.push(`   ${decision.approach}`);
        }
      });
      lines.push('');
    }
  }

  // Evidence
  if (summary.supportingEvidence.length > 0) {
    lines.push('## Supporting Evidence');
    summary.supportingEvidence.forEach((ref, idx) => {
      const conf = ref.confidence ? ` (confidence: ${ref.confidence.toFixed(2)})` : '';
      lines.push(`${idx + 1}. ${ref.title}${conf}`);
      if (ref.url) {
        lines.push(`   ${ref.url}`);
      }
    });
    lines.push('');
  }

  // Open items
  if (summary.openItems.length > 0) {
    lines.push('## Outstanding Risks/Questions');
    summary.openItems.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item}`);
    });
    lines.push('');
  }

  lines.push(`*Summary v${summary.summaryVersion} - Single snapshot from latest completed journey*`);

  return lines.join('\n');
}
