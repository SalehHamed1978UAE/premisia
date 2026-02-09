/**
 * Journey Summary Service
 * Creates and manages compact summaries of completed journeys for follow-on runs
 */
import { db } from '../db';
import { journeySessions } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { encryptJSONKMS, decryptJSONKMS } from '../utils/kms-encryption';
/**
 * Summary Builder for Five Whys + BMC Journey
 * Extracts root causes, BMC value propositions, and strategic recommendations
 */
function buildFiveWhysBmcSummary(context, sessionMeta) {
    const keyInsights = [];
    const frameworks = {};
    const strategicImplications = [];
    // Extract Five Whys root causes
    if (context.insights.rootCauses && context.insights.rootCauses.length > 0) {
        const rootCause = context.insights.rootCauses[0];
        keyInsights.push(`Root Cause: ${rootCause}`);
        frameworks.five_whys = {
            rootCauses: context.insights.rootCauses,
            whysPath: context.insights.whysPath || [],
        };
    }
    // Extract BMC key value propositions and customer segments
    if (context.insights.bmcBlocks) {
        const valueProps = context.insights.bmcBlocks.value_propositions;
        const customerSegments = context.insights.bmcBlocks.customer_segments;
        if (valueProps) {
            keyInsights.push(`Value Proposition: ${JSON.stringify(valueProps).substring(0, 100)}...`);
        }
        if (customerSegments) {
            keyInsights.push(`Target Customers: ${JSON.stringify(customerSegments).substring(0, 100)}...`);
        }
        frameworks.bmc = {
            valuePropositions: valueProps,
            customerSegments: customerSegments,
            revenueStreams: context.insights.bmcBlocks.revenue_streams,
            keyActivities: context.insights.bmcBlocks.key_activities,
        };
    }
    // Extract strategic implications
    if (context.insights.strategicImplications && context.insights.strategicImplications.length > 0) {
        strategicImplications.push(...context.insights.strategicImplications.slice(0, 3));
    }
    else {
        // Generate basic implications
        strategicImplications.push('Business model redesign needed to address root causes');
        strategicImplications.push('Focus on validated customer segments and value propositions');
        if (context.insights.businessModelGaps && context.insights.businessModelGaps.length > 0) {
            strategicImplications.push('Address critical business model gaps identified');
        }
    }
    return {
        journeyType: context.journeyType,
        completedAt: sessionMeta.completedAt,
        versionNumber: sessionMeta.versionNumber,
        keyInsights: keyInsights.slice(0, 5),
        frameworks,
        strategicImplications: strategicImplications.slice(0, 3),
    };
}
/**
 * Summary Builder for PESTLE + Porter's Journey
 * Extracts external trends, competitive forces, and strategic opportunities
 */
function buildPestlePortersSummary(context, sessionMeta) {
    const keyInsights = [];
    const frameworks = {};
    const strategicImplications = [];
    // Extract PESTLE trends
    if (context.insights.trendFactors) {
        const factors = Object.entries(context.insights.trendFactors).slice(0, 3);
        factors.forEach(([category, data]) => {
            keyInsights.push(`${category.toUpperCase()} Trend: ${JSON.stringify(data).substring(0, 80)}...`);
        });
        frameworks.pestle = context.insights.trendFactors;
    }
    // Extract Porter's competitive forces
    if (context.insights.portersForces) {
        const forces = Object.entries(context.insights.portersForces).slice(0, 2);
        forces.forEach(([force, data]) => {
            keyInsights.push(`Competitive Force (${force}): ${JSON.stringify(data).substring(0, 80)}...`);
        });
        frameworks.porters = context.insights.portersForces;
    }
    // Strategic implications
    strategicImplications.push('Monitor identified external trends for market timing');
    strategicImplications.push('Develop strategies to counter competitive pressures');
    if (context.insights.keyOpportunities && context.insights.keyOpportunities.length > 0) {
        strategicImplications.push(`Capitalize on ${context.insights.keyOpportunities.length} identified opportunities`);
    }
    return {
        journeyType: context.journeyType,
        completedAt: sessionMeta.completedAt,
        versionNumber: sessionMeta.versionNumber,
        keyInsights: keyInsights.slice(0, 5),
        frameworks,
        strategicImplications: strategicImplications.slice(0, 3),
    };
}
/**
 * Summary Builder for Porter's + BMC Journey
 * Extracts competitive pressures, differentiation points, and strategic positioning
 */
function buildPortersBmcSummary(context, sessionMeta) {
    const keyInsights = [];
    const frameworks = {};
    const strategicImplications = [];
    // Extract Porter's competitive pressures
    if (context.insights.competitivePressures && context.insights.competitivePressures.length > 0) {
        context.insights.competitivePressures.slice(0, 2).forEach(pressure => {
            keyInsights.push(`Competitive Pressure: ${pressure}`);
        });
    }
    if (context.insights.portersForces) {
        frameworks.porters = context.insights.portersForces;
    }
    // Extract BMC differentiation points
    if (context.insights.bmcBlocks) {
        const valueProps = context.insights.bmcBlocks.value_propositions;
        const keyResources = context.insights.bmcBlocks.key_resources;
        if (valueProps) {
            keyInsights.push(`Differentiation: ${JSON.stringify(valueProps).substring(0, 100)}...`);
        }
        frameworks.bmc = {
            valuePropositions: valueProps,
            keyResources: keyResources,
            keyActivities: context.insights.bmcBlocks.key_activities,
        };
    }
    // Strategic implications
    strategicImplications.push('Build defensible competitive advantages');
    strategicImplications.push('Focus on unique value propositions to counter competitive forces');
    strategicImplications.push('Strengthen key resources and partnerships');
    return {
        journeyType: context.journeyType,
        completedAt: sessionMeta.completedAt,
        versionNumber: sessionMeta.versionNumber,
        keyInsights: keyInsights.slice(0, 5),
        frameworks,
        strategicImplications: strategicImplications.slice(0, 3),
    };
}
/**
 * Summary Builder for PESTLE + BMC Journey
 * Extracts macro trends, BMC adaptations, and growth opportunities
 */
function buildPestleBmcSummary(context, sessionMeta) {
    const keyInsights = [];
    const frameworks = {};
    const strategicImplications = [];
    // Extract PESTLE macro trends
    if (context.insights.trendFactors) {
        const factors = Object.entries(context.insights.trendFactors).slice(0, 3);
        factors.forEach(([category, data]) => {
            keyInsights.push(`${category.toUpperCase()}: ${JSON.stringify(data).substring(0, 80)}...`);
        });
        frameworks.pestle = context.insights.trendFactors;
    }
    // Extract BMC adaptations
    if (context.insights.bmcBlocks) {
        const channels = context.insights.bmcBlocks.channels;
        const customerRelationships = context.insights.bmcBlocks.customer_relationships;
        if (channels) {
            keyInsights.push(`Digital Channels: ${JSON.stringify(channels).substring(0, 80)}...`);
        }
        frameworks.bmc = {
            channels: channels,
            customerRelationships: customerRelationships,
            keyActivities: context.insights.bmcBlocks.key_activities,
            valuePropositions: context.insights.bmcBlocks.value_propositions,
        };
    }
    // Strategic implications
    strategicImplications.push('Adapt business model to identified macro trends');
    strategicImplications.push('Leverage digital channels for growth');
    if (context.insights.keyOpportunities && context.insights.keyOpportunities.length > 0) {
        strategicImplications.push('Pursue growth opportunities aligned with trends');
    }
    return {
        journeyType: context.journeyType,
        completedAt: sessionMeta.completedAt,
        versionNumber: sessionMeta.versionNumber,
        keyInsights: keyInsights.slice(0, 5),
        frameworks,
        strategicImplications: strategicImplications.slice(0, 3),
    };
}
/**
 * Summary Builder for Five Whys + SWOT Journey
 * Extracts root causes, SWOT quadrants, and turnaround priorities
 */
function buildFiveWhysSwotSummary(context, sessionMeta) {
    const keyInsights = [];
    const frameworks = {};
    const strategicImplications = [];
    // Extract Five Whys root causes
    if (context.insights.rootCauses && context.insights.rootCauses.length > 0) {
        const rootCause = context.insights.rootCauses[0];
        keyInsights.push(`Root Cause: ${rootCause}`);
        frameworks.five_whys = {
            rootCauses: context.insights.rootCauses,
            whysPath: context.insights.whysPath || [],
        };
    }
    // Extract SWOT quadrants (placeholder - SWOT not yet implemented)
    // When SWOT is implemented, extract strengths, weaknesses, opportunities, threats
    keyInsights.push('SWOT analysis: Pending implementation');
    frameworks.swot = {
        placeholder: 'SWOT framework not yet implemented',
    };
    // Strategic implications for crisis recovery
    strategicImplications.push('Address identified root causes immediately');
    strategicImplications.push('Leverage internal strengths for turnaround');
    strategicImplications.push('Mitigate critical weaknesses');
    return {
        journeyType: context.journeyType,
        completedAt: sessionMeta.completedAt,
        versionNumber: sessionMeta.versionNumber,
        keyInsights: keyInsights.slice(0, 5),
        frameworks,
        strategicImplications: strategicImplications.slice(0, 3),
    };
}
/**
 * Summary Builder for PESTLE + Ansoff Journey
 * Extracts trends, growth vectors, and expansion recommendations
 */
function buildPestleAnsoffSummary(context, sessionMeta) {
    const keyInsights = [];
    const frameworks = {};
    const strategicImplications = [];
    // Extract PESTLE trends
    if (context.insights.trendFactors) {
        const factors = Object.entries(context.insights.trendFactors).slice(0, 3);
        factors.forEach(([category, data]) => {
            keyInsights.push(`${category.toUpperCase()} Trend: ${JSON.stringify(data).substring(0, 80)}...`);
        });
        frameworks.pestle = context.insights.trendFactors;
    }
    // Extract Ansoff growth vectors (placeholder - Ansoff not yet implemented)
    keyInsights.push('Ansoff Matrix: Pending implementation');
    frameworks.ansoff = {
        placeholder: 'Ansoff framework not yet implemented',
    };
    // Strategic implications
    strategicImplications.push('Align growth strategy with identified trends');
    strategicImplications.push('Evaluate market penetration vs. diversification');
    if (context.insights.keyOpportunities && context.insights.keyOpportunities.length > 0) {
        strategicImplications.push('Prioritize expansion opportunities by risk/reward');
    }
    return {
        journeyType: context.journeyType,
        completedAt: sessionMeta.completedAt,
        versionNumber: sessionMeta.versionNumber,
        keyInsights: keyInsights.slice(0, 5),
        frameworks,
        strategicImplications: strategicImplications.slice(0, 3),
    };
}
/**
 * Registry of summary builders keyed by journey type's summaryBuilder string
 */
export const summaryBuilders = {
    fiveWhysBmc: buildFiveWhysBmcSummary,
    pestlePorters: buildPestlePortersSummary,
    portersBmc: buildPortersBmcSummary,
    pestleBmc: buildPestleBmcSummary,
    fiveWhysSwot: buildFiveWhysSwotSummary,
    pestleAnsoff: buildPestleAnsoffSummary,
};
/**
 * Save a journey summary to the database (encrypted)
 * @param journeySessionId - The journey session ID
 * @param summary - The summary to save
 */
export async function saveSummary(journeySessionId, summary) {
    // Encrypt the summary before storing
    const encryptedSummary = await encryptJSONKMS(summary);
    await db
        .update(journeySessions)
        .set({ summary: encryptedSummary })
        .where(eq(journeySessions.id, journeySessionId));
    console.log(`[JourneySummaryService] ✓ Saved encrypted summary for session ${journeySessionId}`);
}
/**
 * Get the latest summary for an understanding and journey type
 * Returns the summary from the most recent completed journey session
 * CRITICAL: Filters by BOTH understandingId AND journeyType to prevent wrong baseline data
 * @param understandingId - The understanding ID
 * @param journeyType - The journey type to filter by
 * @returns The most recent journey summary for this journey type, or null if none exists
 */
export async function getLatestSummary(understandingId, journeyType) {
    const sessions = await db
        .select()
        .from(journeySessions)
        .where(and(eq(journeySessions.understandingId, understandingId), eq(journeySessions.journeyType, journeyType), eq(journeySessions.status, 'completed')))
        .orderBy(desc(journeySessions.versionNumber))
        .limit(1);
    if (sessions.length === 0 || !sessions[0].summary) {
        return null;
    }
    // Decrypt the summary
    const decrypted = await decryptJSONKMS(sessions[0].summary);
    return decrypted;
}
/**
 * Get the summary for a specific journey session
 * @param journeySessionId - The journey session ID
 * @returns The journey summary, or null if not found or not completed
 */
export async function getSummaryForSession(journeySessionId) {
    const sessions = await db
        .select()
        .from(journeySessions)
        .where(eq(journeySessions.id, journeySessionId))
        .limit(1);
    if (sessions.length === 0 || !sessions[0].summary) {
        return null;
    }
    // Decrypt the summary
    const decrypted = await decryptJSONKMS(sessions[0].summary);
    return decrypted;
}
/**
 * Build a journey summary using the appropriate summary builder
 * @param summaryBuilderType - The summary builder type (e.g., 'fiveWhysBmc', 'pestlePorters')
 * @param context - The completed journey context
 * @param sessionMeta - Session metadata (version number and completion timestamp)
 * @returns The built journey summary
 * @throws Error if summaryBuilderType is not found in registry
 */
export function buildSummary(summaryBuilderType, context, sessionMeta) {
    const builder = summaryBuilders[summaryBuilderType];
    if (!builder) {
        throw new Error(`Summary builder "${summaryBuilderType}" not found in registry. Available builders: ${Object.keys(summaryBuilders).join(', ')}`);
    }
    return builder(context, sessionMeta);
}
/**
 * Journey Summary Service - Exported service object for use by journey orchestrator
 */
export const journeySummaryService = {
    buildSummary,
    saveSummary,
    getLatestSummary,
    getSummaryForSession,
};
//# sourceMappingURL=journey-summary-service.js.map