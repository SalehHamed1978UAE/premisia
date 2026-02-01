/**
 * Role Templates - Context-Aware Role Mapping
 * Architecture Spec Section 16.3
 *
 * Provides industry/business-specific role templates to ensure EPM generates
 * appropriate resources for each business type.
 *
 * CRITICAL: A cafe should get "Cafe Manager", "Head Barista" - NOT "Corporate Sales Manager"
 *
 * TODO: Replace hardcoded templates with Context Foundry integration
 * - Use CF entity extraction to infer business type dynamically
 * - Use CF to suggest appropriate roles based on business context
 * - Keep templates as fallback only, not primary source
 * - This will make role selection more robust and scalable
 * See: Context Foundry integration discussion (Feb 2026)
 */

import type { BusinessCategory, RoleTemplate, StrategyContext, RiskCategory } from '../types';

// ============================================================================
// Role Templates by Business Category and Subcategory
// ============================================================================

export const ROLE_TEMPLATES: Record<BusinessCategory, Record<string, RoleTemplate[]>> = {
  food_beverage: {
    cafe_coffee_shop: [
      // Core Operations
      { role: 'Cafe Operations Manager', fte: 1.0, skills: ['cafe operations', 'staff management', 'inventory control', 'P&L'] },
      { role: 'Head Barista', fte: 0.8, skills: ['espresso preparation', 'latte art', 'quality control', 'training'] },
      // Launch/Project Functional Roles
      { role: 'Cafe Design & Construction Lead', fte: 0.7, skills: ['interior design', 'contractor management', 'buildout', 'permits'] },
      { role: 'Technology & Systems Specialist', fte: 0.6, skills: ['POS systems', 'WiFi infrastructure', 'digital integration', 'customer experience tech'] },
      { role: 'HR & Training Coordinator', fte: 0.6, skills: ['recruitment', 'barista training', 'onboarding', 'staff scheduling'] },
      { role: 'Marketing & Community Manager', fte: 0.6, skills: ['local marketing', 'social media', 'community events', 'brand building'] },
      { role: 'Compliance & Licensing Specialist', fte: 0.5, skills: ['food safety', 'health permits', 'regulatory compliance', 'inspections'] },
    ],
    restaurant: [
      // Core Operations
      { role: 'Restaurant Operations Manager', fte: 1.0, skills: ['restaurant operations', 'P&L management', 'vendor relations'] },
      { role: 'Executive Chef', fte: 1.0, skills: ['menu development', 'kitchen management', 'food costing'] },
      { role: 'Front of House Manager', fte: 0.8, skills: ['customer service', 'reservations', 'staff supervision'] },
      // Launch/Project Functional Roles
      { role: 'Restaurant Design & Buildout Lead', fte: 0.7, skills: ['interior design', 'kitchen layout', 'contractor management'] },
      { role: 'Technology & POS Specialist', fte: 0.5, skills: ['POS systems', 'reservation systems', 'inventory tech'] },
      { role: 'HR & Training Manager', fte: 0.6, skills: ['recruitment', 'server training', 'kitchen staff onboarding'] },
      { role: 'Marketing & PR Coordinator', fte: 0.6, skills: ['restaurant marketing', 'social media', 'PR', 'events'] },
      { role: 'Compliance & Health Safety Lead', fte: 0.5, skills: ['food safety', 'health inspections', 'licensing', 'HACCP'] },
    ],
    catering: [
      { role: 'Catering Operations Manager', fte: 1.0, skills: ['event coordination', 'logistics'] },
      { role: 'Corporate Sales Manager', fte: 1.0, skills: ['B2B sales', 'account management'] },
      { role: 'Executive Chef', fte: 1.0, skills: ['menu planning', 'large-scale cooking'] },
      { role: 'Event Coordinator', fte: 0.8, skills: ['client relations', 'event planning'] },
    ],
    default: [
      { role: 'Operations Manager', fte: 1.0, skills: ['food service operations', 'staff management'] },
      { role: 'Kitchen Manager', fte: 0.8, skills: ['food preparation', 'inventory'] },
      { role: 'Service Lead', fte: 0.6, skills: ['customer service', 'team coordination'] },
    ],
  },

  retail_specialty: {
    athletic_footwear: [
      { role: 'Store Manager', fte: 1.0, skills: ['retail management', 'visual merchandising', 'P&L'] },
      { role: 'Assistant Store Manager', fte: 0.8, skills: ['inventory management', 'staff scheduling'] },
      { role: 'Visual Merchandising Lead', fte: 0.6, skills: ['product display', 'brand presentation'] },
      { role: 'Sales Associate Lead', fte: 0.6, skills: ['footwear fitting', 'product knowledge', 'upselling'] },
      { role: 'Inventory Specialist', fte: 0.5, skills: ['stock management', 'receiving', 'POS systems'] },
      { role: 'Marketing Coordinator', fte: 0.5, skills: ['social media', 'local marketing', 'events'] },
    ],
    fashion_apparel: [
      { role: 'Store Manager', fte: 1.0, skills: ['fashion retail', 'visual merchandising'] },
      { role: 'Fashion Stylist', fte: 0.8, skills: ['personal styling', 'trend awareness'] },
      { role: 'Visual Merchandiser', fte: 0.6, skills: ['window displays', 'store layout'] },
      { role: 'Sales Associate', fte: 0.5, skills: ['customer service', 'product knowledge'] },
    ],
    electronics: [
      { role: 'Store Manager', fte: 1.0, skills: ['electronics retail', 'technical knowledge'] },
      { role: 'Technical Sales Specialist', fte: 0.8, skills: ['product demos', 'troubleshooting'] },
      { role: 'Service Technician', fte: 0.6, skills: ['repairs', 'warranties'] },
      { role: 'Sales Associate', fte: 0.5, skills: ['customer service', 'upselling'] },
    ],
    default: [
      { role: 'Store Manager', fte: 1.0, skills: ['retail operations', 'staff management', 'inventory'] },
      { role: 'Assistant Manager', fte: 0.8, skills: ['daily operations', 'customer service'] },
      { role: 'Sales Lead', fte: 0.6, skills: ['sales', 'product knowledge', 'customer relations'] },
      { role: 'Visual Merchandiser', fte: 0.5, skills: ['product display', 'store presentation'] },
      { role: 'Sales Associate', fte: 0.4, skills: ['customer service', 'sales'] },
    ],
  },

  retail_general: {
    default: [
      { role: 'Store Manager', fte: 1.0, skills: ['retail management', 'P&L responsibility'] },
      { role: 'Assistant Manager', fte: 0.8, skills: ['staff supervision', 'inventory'] },
      { role: 'Department Lead', fte: 0.6, skills: ['category management', 'customer service'] },
      { role: 'Cashier/Sales Associate', fte: 0.4, skills: ['POS operations', 'customer assistance'] },
    ],
  },

  retail_electronics: {
    default: [
      { role: 'Store Manager', fte: 1.0, skills: ['electronics retail', 'technical sales'] },
      { role: 'Technical Sales Manager', fte: 0.8, skills: ['product expertise', 'consultative selling'] },
      { role: 'Service & Support Lead', fte: 0.6, skills: ['troubleshooting', 'warranties', 'repairs'] },
      { role: 'Sales Consultant', fte: 0.5, skills: ['product demos', 'customer education'] },
    ],
  },

  retail_home_goods: {
    default: [
      { role: 'Store Manager', fte: 1.0, skills: ['home retail', 'visual merchandising'] },
      { role: 'Design Consultant', fte: 0.8, skills: ['interior design', 'customer consultation'] },
      { role: 'Warehouse/Receiving Lead', fte: 0.6, skills: ['logistics', 'inventory management'] },
      { role: 'Sales Associate', fte: 0.5, skills: ['customer service', 'product knowledge'] },
    ],
  },

  professional_services: {
    consulting: [
      { role: 'Managing Director', fte: 1.0, skills: ['client relations', 'business development'] },
      { role: 'Senior Consultant', fte: 0.8, skills: ['strategy', 'analysis', 'presentations'] },
      { role: 'Consultant', fte: 0.6, skills: ['research', 'analysis', 'client delivery'] },
      { role: 'Business Analyst', fte: 0.5, skills: ['data analysis', 'documentation'] },
    ],
    default: [
      { role: 'Practice Lead', fte: 1.0, skills: ['service delivery', 'client management'] },
      { role: 'Senior Specialist', fte: 0.8, skills: ['domain expertise', 'project management'] },
      { role: 'Specialist', fte: 0.6, skills: ['service delivery', 'client support'] },
      { role: 'Coordinator', fte: 0.4, skills: ['scheduling', 'administration'] },
    ],
  },

  saas_platform: {
    default: [
      { role: 'Product Manager', fte: 1.0, skills: ['product strategy', 'roadmap planning'] },
      { role: 'Tech Lead', fte: 1.0, skills: ['architecture', 'code review', 'technical decisions'] },
      { role: 'Full Stack Developer', fte: 0.8, skills: ['frontend', 'backend', 'APIs'] },
      { role: 'UX Designer', fte: 0.6, skills: ['user research', 'UI design', 'prototyping'] },
      { role: 'Customer Success Manager', fte: 0.6, skills: ['onboarding', 'retention', 'support'] },
      { role: 'DevOps Engineer', fte: 0.5, skills: ['CI/CD', 'cloud infrastructure', 'monitoring'] },
    ],
  },

  manufacturing: {
    default: [
      { role: 'Plant Manager', fte: 1.0, skills: ['manufacturing operations', 'lean principles'] },
      { role: 'Production Supervisor', fte: 0.8, skills: ['line management', 'quality control'] },
      { role: 'Quality Assurance Lead', fte: 0.6, skills: ['QA/QC', 'compliance', 'testing'] },
      { role: 'Maintenance Technician', fte: 0.5, skills: ['equipment maintenance', 'troubleshooting'] },
      { role: 'Supply Chain Coordinator', fte: 0.5, skills: ['procurement', 'logistics'] },
    ],
  },

  ecommerce: {
    default: [
      { role: 'E-commerce Manager', fte: 1.0, skills: ['online retail', 'platform management'] },
      { role: 'Digital Marketing Manager', fte: 0.8, skills: ['SEO/SEM', 'paid advertising', 'email'] },
      { role: 'Fulfillment Lead', fte: 0.6, skills: ['warehouse ops', 'shipping', 'returns'] },
      { role: 'Customer Service Lead', fte: 0.5, skills: ['support tickets', 'chat', 'returns'] },
      { role: 'Content Specialist', fte: 0.4, skills: ['product descriptions', 'photography'] },
    ],
  },

  generic: {
    default: [
      { role: 'General Manager', fte: 1.0, skills: ['business operations', 'P&L management'] },
      { role: 'Operations Manager', fte: 0.8, skills: ['day-to-day operations', 'process improvement'] },
      { role: 'Marketing Manager', fte: 0.6, skills: ['marketing strategy', 'brand management'] },
      { role: 'Finance/Admin Lead', fte: 0.5, skills: ['bookkeeping', 'reporting', 'administration'] },
      { role: 'Team Lead', fte: 0.5, skills: ['team coordination', 'customer relations'] },
    ],
  },
};

// ============================================================================
// Role Selection Functions
// ============================================================================

/**
 * Select appropriate roles based on StrategyContext
 * Architecture Spec: First try exact subcategory, then category default, then generic
 */
export function selectRoles(context: StrategyContext): RoleTemplate[] {
  const category = context.businessType.category;
  const subcategory = context.businessType.subcategory;

  console.log(`[RoleTemplates] Selecting roles for category="${category}", subcategory="${subcategory}"`);

  // First try exact subcategory match
  if (subcategory && ROLE_TEMPLATES[category]?.[subcategory]) {
    console.log(`[RoleTemplates] Using exact subcategory match: ${category}.${subcategory}`);
    return ROLE_TEMPLATES[category][subcategory];
  }

  // Fall back to category default
  if (ROLE_TEMPLATES[category]?.default) {
    console.log(`[RoleTemplates] Using category default: ${category}.default`);
    return ROLE_TEMPLATES[category].default;
  }

  // Ultimate fallback to generic
  console.log(`[RoleTemplates] Using generic fallback`);
  return ROLE_TEMPLATES.generic.default;
}

/**
 * Infer subcategory from business name and keywords
 */
export function inferSubcategory(context: StrategyContext): string | undefined {
  const name = context.businessType.name.toLowerCase();
  const keywords = context.industry.keywords.map(k => k.toLowerCase());
  const allText = `${name} ${keywords.join(' ')}`;

  // Retail specialty subcategories
  if (context.businessType.category === 'retail_specialty') {
    if (allText.match(/basketball|sneaker|footwear|athletic|shoe/)) {
      return 'athletic_footwear';
    }
    if (allText.match(/fashion|apparel|clothing|boutique/)) {
      return 'fashion_apparel';
    }
    if (allText.match(/electronics|gadget|phone|computer/)) {
      return 'electronics';
    }
  }

  // Food & beverage subcategories
  if (context.businessType.category === 'food_beverage') {
    if (allText.match(/cafe|coffee|espresso/)) {
      return 'cafe_coffee_shop';
    }
    if (allText.match(/restaurant|dining|cuisine/)) {
      return 'restaurant';
    }
    if (allText.match(/catering|corporate.*food|event.*food/)) {
      return 'catering';
    }
  }

  // Professional services subcategories
  if (context.businessType.category === 'professional_services') {
    if (allText.match(/consulting|consultancy|advisory/)) {
      return 'consulting';
    }
  }

  return undefined;
}

// ============================================================================
// Risk Owner Mapping (Architecture Spec Section 17.4)
// ============================================================================

export const RISK_CATEGORY_OWNER_MAP: Record<RiskCategory, string[]> = {
  strategic: ['General Manager', 'CEO', 'Managing Director', 'Store Manager', 'Practice Lead'],
  operational: ['Operations Manager', 'Store Manager', 'Plant Manager', 'Cafe Manager'],
  financial: ['Finance Manager', 'CFO', 'Controller', 'General Manager', 'Finance/Admin Lead'],
  compliance: ['Compliance Officer', 'Legal', 'Operations Manager', 'Quality Assurance Lead'],
  reputational: ['Marketing Manager', 'PR Manager', 'General Manager', 'Customer Success Manager'],
  execution: ['Project Manager', 'Program Manager', 'Operations Manager', 'Tech Lead'],
};

/**
 * Find the best risk owner from available resources
 */
export function findRiskOwner(
  riskCategory: RiskCategory,
  availableRoles: string[],
  usedOwners: Map<string, number> = new Map()
): string {
  const candidateRoles = RISK_CATEGORY_OWNER_MAP[riskCategory] || [];
  const rolesLower = availableRoles.map(r => r.toLowerCase());

  // First pass: find matching role with lowest usage count
  let bestMatch: { role: string; count: number } | null = null;

  for (const candidate of candidateRoles) {
    const matchIdx = rolesLower.findIndex(r => r.includes(candidate.toLowerCase()));
    if (matchIdx >= 0) {
      const actualRole = availableRoles[matchIdx];
      const usageCount = usedOwners.get(actualRole) || 0;

      if (!bestMatch || usageCount < bestMatch.count) {
        bestMatch = { role: actualRole, count: usageCount };
      }
    }
  }

  if (bestMatch) {
    return bestMatch.role;
  }

  // Fallback: return least-used available role
  let leastUsed = availableRoles[0];
  let leastCount = usedOwners.get(availableRoles[0]) || 0;

  for (const role of availableRoles) {
    const count = usedOwners.get(role) || 0;
    if (count < leastCount) {
      leastUsed = role;
      leastCount = count;
    }
  }

  return leastUsed || 'Project Lead';
}

// ============================================================================
// Benefit Owner Mapping
// ============================================================================

export const BENEFIT_CATEGORY_OWNER_MAP: Record<string, string[]> = {
  Financial: ['Finance Manager', 'CFO', 'General Manager', 'Store Manager'],
  Strategic: ['General Manager', 'CEO', 'Managing Director', 'Practice Lead'],
  Operational: ['Operations Manager', 'Store Manager', 'Plant Manager'],
  'Risk Mitigation': ['Operations Manager', 'Compliance Officer', 'Quality Assurance Lead'],
  Revenue: ['Sales Manager', 'Marketing Manager', 'Store Manager', 'E-commerce Manager'],
  'Customer Experience': ['Customer Success Manager', 'Store Manager', 'Service Lead'],
  Brand: ['Marketing Manager', 'Marketing Coordinator', 'General Manager'],
};

/**
 * Find the best benefit owner from available resources
 */
export function findBenefitOwner(
  benefitCategory: string,
  availableRoles: string[],
  usedOwners: Map<string, number> = new Map()
): string {
  const candidateRoles = BENEFIT_CATEGORY_OWNER_MAP[benefitCategory] ||
                         BENEFIT_CATEGORY_OWNER_MAP['Operational'] || [];
  const rolesLower = availableRoles.map(r => r.toLowerCase());

  // Find matching role with lowest usage
  let bestMatch: { role: string; count: number } | null = null;

  for (const candidate of candidateRoles) {
    const matchIdx = rolesLower.findIndex(r => r.includes(candidate.toLowerCase()));
    if (matchIdx >= 0) {
      const actualRole = availableRoles[matchIdx];
      const usageCount = usedOwners.get(actualRole) || 0;

      if (!bestMatch || usageCount < bestMatch.count) {
        bestMatch = { role: actualRole, count: usageCount };
      }
    }
  }

  if (bestMatch) {
    return bestMatch.role;
  }

  // Fallback: round-robin through available roles
  let leastUsed = availableRoles[0];
  let leastCount = usedOwners.get(availableRoles[0]) || 0;

  for (const role of availableRoles) {
    const count = usedOwners.get(role) || 0;
    if (count < leastCount) {
      leastUsed = role;
      leastCount = count;
    }
  }

  return leastUsed || 'Project Lead';
}
