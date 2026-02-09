/**
 * Framework Result Types
 * Discriminated unions for all strategic framework outputs
 */
/**
 * Framework metadata registry
 */
export const FRAMEWORK_METADATA = {
    five_whys: {
        name: 'five_whys',
        displayName: 'Five Whys',
        description: 'Root cause analysis through iterative questioning',
        icon: '🎯',
        estimatedDuration: '2-3 minutes',
    },
    bmc: {
        name: 'bmc',
        displayName: 'Business Model Canvas',
        description: 'Comprehensive business model design and validation',
        icon: '📊',
        estimatedDuration: '5-7 minutes',
    },
    porters: {
        name: 'porters',
        displayName: "Porter's Five Forces",
        description: 'Industry competitive dynamics analysis',
        icon: '⚔️',
        estimatedDuration: '4-6 minutes',
    },
    pestle: {
        name: 'pestle',
        displayName: 'PESTLE Analysis',
        description: 'External macro-environmental factors',
        icon: '🌍',
        estimatedDuration: '5-7 minutes',
    },
    swot: {
        name: 'swot',
        displayName: 'SWOT Analysis',
        description: 'Strengths, weaknesses, opportunities, and threats',
        icon: '📈',
        estimatedDuration: '3-5 minutes',
    },
    ansoff: {
        name: 'ansoff',
        displayName: 'Ansoff Matrix',
        description: 'Growth strategy matrix for market/product expansion',
        icon: '📐',
        estimatedDuration: '3-4 minutes',
    },
    blue_ocean: {
        name: 'blue_ocean',
        displayName: 'Blue Ocean Strategy',
        description: 'Value innovation and uncontested market space',
        icon: '🌊',
        estimatedDuration: '6-8 minutes',
    },
};
//# sourceMappingURL=framework-types.js.map