import type { Express } from "express";
import { createServer, type Server } from "http";
import { initializeSupabaseAuth, isAuthenticated } from "./supabaseAuth";
import { storage } from "./storage";
import { insertProgramSchema, insertWorkstreamSchema, insertStageGateSchema, insertTaskSchema, insertKpiSchema, insertRiskSchema, insertBenefitSchema, insertFundingSourceSchema, insertExpenseSchema, insertResourceSchema, insertSessionContextSchema, orchestratorTaskSchema, backgroundJobs, journeySessions, strategicUnderstanding, sessionContext, references, strategyVersions, epmPrograms } from "@shared/schema";
import { ontologyService } from "./ontology-service";
import { assessmentService } from "./assessment-service";
import { Orchestrator } from "./orchestrator";
import strategicConsultantLegacyRoutes from "./routes/strategic-consultant-legacy";
import strategicConsultantV2Routes from "./routes/strategic-consultant-v2";
import documentEnrichmentRoutes from "./routes/document-enrichment";
import trendAnalysisRoutes from "./routes/trend-analysis";
import statementRepositoryRoutes from "./routes/statement-repository.routes";
import strategyWorkspaceRoutes from "./routes/strategy-workspace";
import journeyBuilderRoutes from "./routes/journey-builder";
import taskAssignmentsRoutes from "./routes/task-assignments";
import exportsRoutes from "./routes/exports";
import knowledgeRoutes from "./routes/knowledge";
import marketingConsultantRoutes from "./routes/marketing-consultant";
import strategiesHubRoutes from "./routes/strategies-hub";
import epmCrudRoutes from "./routes/epm-crud";
import ontologyRoutes from "./routes/ontology";
import { moduleRegistryRouter } from "./routes/module-registry";
import customJourneyBuilderRoutes from "./routes/custom-journey-builder";
import { initializeModuleSystem } from "./modules/initialize";
import { backgroundJobService } from "./services/background-job-service";
import { decrypt } from "./utils/encryption";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { db } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize module catalog and journey config system
  initializeModuleSystem();

  // Initialize Supabase Auth
  // Skip Supabase setup only when BOTH DEV_AUTH_BYPASS=true AND NODE_ENV=development
  const shouldSkipSupabase = process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development';
  if (!shouldSkipSupabase) {
    initializeSupabaseAuth();
    console.log('[Auth] Supabase authentication configured');
  } else {
    console.log('[Auth] Skipping Supabase setup (DEV_AUTH_BYPASS=true in development)');
  }

  // Auth endpoints for Supabase
  // Simple endpoint that returns the current user (frontend will handle actual auth)
  app.post('/api/auth/logout', (req, res) => {
    // Supabase handles logout client-side, this is just for compatibility
    res.json({ success: true });
  });

  // Auth user endpoint (works with both Supabase and dev bypass)
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // The isAuthenticated middleware already attached the full user object
      // from our database to req.user, so just return it
      const user = req.user;

      // Remove the claims wrapper for cleaner response
      const { claims, ...cleanUser } = user;
      res.json(cleanUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard summary endpoint
  app.get('/api/dashboard-summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summary = await storage.getDashboardSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
  });

  // Test endpoint for intelligent planning system
  // Uses request-scoped override - no global state mutation
  // TEMPORARY: Auth bypassed for testing
  app.post('/api/test/intelligent-planning', async (req: any, res) => {
    try {
      console.log('\n========================================');
      console.log('🧪 TEST MODE: Intelligent Planning ENABLED (request-scoped)');
      console.log('========================================\n');
      
      // Import EPM synthesizer
      const { EPMSynthesizer } = await import('./intelligence');
      const { createOpenAIProvider } = await import('../src/lib/intelligent-planning/llm-provider');
      
      const llm = createOpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-5'
      });
      
      const epmSynthesizer = new EPMSynthesizer(llm);
      
      // Get insights and decisions from request body
      const { insights, userDecisions, namingContext } = req.body;
      
      if (!insights) {
        return res.status(400).json({ error: 'Missing required field: insights' });
      }
      
      // Generate EPM program with intelligent planning enabled via options
      // This is request-scoped and doesn't affect other requests
      const epmProgram = await epmSynthesizer.synthesize(
        insights, 
        userDecisions, 
        namingContext,
        { forceIntelligentPlanning: true } // Request-scoped override
      );
      
      console.log('\n========================================');
      console.log('✅ TEST COMPLETE: Intelligent Planning Result');
      console.log('========================================\n');
      
      res.json({
        success: true,
        usedIntelligentPlanning: true,
        program: epmProgram,
        testMode: true,
        message: 'This was generated with intelligent planning enabled (request-scoped)'
      });
      
    } catch (error: any) {
      console.error('❌ TEST FAILED: Intelligent Planning Error:', error);
      res.status(500).json({ 
        error: error.message || 'Intelligent planning test failed',
        stack: error.stack,
        usedIntelligentPlanning: true,
        testMode: true
      });
    }
  });

  // DEVELOPMENT ONLY: Quick EPM test with pre-prepared data
  // Bypasses 5+ minute AI analysis for rapid intelligent planning testing
  app.post('/api/dev/quick-epm-test', async (req: any, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Endpoint not available in production' });
    }

    try {
      console.log('\n🚀 DEV MODE: Quick EPM Test Starting...\n');
      
      const { EPMSynthesizer, BMCAnalyzer } = await import('./intelligence');
      const { createOpenAIProvider } = await import('../src/lib/intelligent-planning/llm-provider');
      
      // Pre-prepared BMC data for traditional Brooklyn coffee shop
      const sampleBMC: any = {
        customerSegments: `Local Brooklyn residents (Williamsburg neighborhood)
Remote workers seeking workspace
Morning commuters (6-9am rush)
Students and freelancers
Weekend brunch crowd`,

        valuePropositions: `Artisanal single-origin coffee from Brooklyn roasters
Cozy community gathering space with free WiFi
Fresh daily-baked pastries and breakfast sandwiches
Laptop-friendly environment for remote work
Local art displays and community events`,

        revenueStreams: `Coffee and espresso drinks ($4-7 per drink)
Food sales (pastries, sandwiches, bagels)
Merchandise (mugs, bags of beans)
Catering for local businesses and events
Private event space rental`,

        channels: `Walk-in storefront (Bedford Ave location)
Instagram and local social media
Partnerships with neighborhood gyms and offices
Word-of-mouth and community events
Simple online ordering for pickup`,

        customerRelationships: `Personalized barista service and name recognition
Loyalty punch card program (10th drink free)
Weekly community events (open mic, art shows)
Regular customer relationships
Active neighborhood presence`,

        keyResources: `Prime Brooklyn retail location (1200 sq ft)
Experienced baristas and staff (8 employees)
Commercial espresso machines and grinders
Relationships with local Brooklyn coffee roasters
Cozy interior atmosphere with 30 seats`,

        keyActivities: `Daily coffee preparation and beverage service
Fresh food preparation (in-house baking)
Customer service and relationship building
Social media marketing and community engagement
Inventory management and supplier coordination`,

        keyPartnerships: `Brooklyn coffee roasters (Cafe Grumpy, Devoción)
Local bakeries for pastries
Food suppliers (dairy, produce)
Neighborhood businesses for cross-promotion
Local artists for rotating displays`,

        costStructure: `Rent and utilities: $8k/month
Staff salaries: $25k/month
Coffee and food inventory: $12k/month
Equipment maintenance: $2k/month
Marketing and events: $3k/month`,

        viability: "strong",
        contradictions: [],
        criticalGaps: [],
        overallConfidence: 0.85,
        recommendations: [
          "Focus on building strong community presence and regular customer base",
          "Develop signature drinks and food items for differentiation",
          "Create a welcoming third-place environment for remote workers",
          "Build strategic partnerships with local Brooklyn roasters and suppliers"
        ],
        executiveSummary: "Traditional Brooklyn coffee shop serving artisanal coffee in a community-focused environment. Business model centers on quality beverages, fresh food, and creating a neighborhood gathering space for local residents and remote workers."
      };
      
      console.log('📊 Converting sample BMC to StrategyInsights...');
      const bmcAnalyzer = new BMCAnalyzer();
      const insights = await bmcAnalyzer.analyze(sampleBMC);
      
      console.log(`✓ Insights extracted: ${insights.insights.length} total`);
      console.log(`✓ Overall confidence: ${Math.round(insights.overallConfidence * 100)}%`);
      console.log(`✓ Market context: ${insights.marketContext.industry || 'tech-enabled retail'}`);
      
      const llm = createOpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4o'
      });
      
      const epmSynthesizer = new EPMSynthesizer(llm);
      
      const userContext = {
        timelineUrgency: 'Strategic' as const,
        budgetRange: {
          min: 400000,
          max: 500000
        }
      };
      
      const namingContext = {
        businessName: "Brooklyn Artisan Coffee Shop",
        executiveInput: "Launch neighborhood coffee shop in Williamsburg, Brooklyn"
      };
      
      console.log('\n⚡ Generating EPM with Intelligent Planning enabled...\n');
      const epmProgram = await epmSynthesizer.synthesize(
        insights,
        userContext,
        namingContext,
        { forceIntelligentPlanning: true }
      );
      
      console.log('\n✅ DEV TEST COMPLETE!\n');
      console.log(`Program: ${(epmProgram as any).programName || 'Unnamed'}`);
      console.log(`Workstreams: ${epmProgram.workstreams.length}`);
      console.log(`Overall Confidence: ${Math.round((epmProgram as any).overallConfidence * 100)}%`);
      
      res.json({
        success: true,
        message: 'Quick EPM test completed - check server logs for intelligent planning output',
        program: epmProgram,
        testData: {
          insights: insights,
          userContext,
          namingContext
        }
      });
      
    } catch (error: any) {
      console.error('❌ Quick EPM test failed:', error);
      res.status(500).json({
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Middleware to check authentication (using Replit Auth)
  const requireAuth = isAuthenticated;

  // Strategic Consultant routes (protected with auth)
  // V2 routes - unified pipeline using Journey Builder
  app.use("/api/strategic-consultant-v2", requireAuth, strategicConsultantV2Routes);
  // Legacy routes kept at original path for backward compatibility
  app.use("/api/strategic-consultant", requireAuth, strategicConsultantLegacyRoutes);
  // Also expose at legacy-specific path
  app.use("/api/strategic-consultant-legacy", requireAuth, strategicConsultantLegacyRoutes);
  app.use("/api/document-enrichment", documentEnrichmentRoutes);
  
  // Trend Analysis routes (protected with auth)
  app.use("/api/trend-analysis", requireAuth, trendAnalysisRoutes);
  
  // Statement Repository routes (protected with auth)
  app.use("/api/repository", requireAuth, statementRepositoryRoutes);
  
  // Strategy Workspace routes (protected with auth)
  app.use("/api/strategy-workspace", requireAuth, strategyWorkspaceRoutes);

  // Journey Builder routes (protected with auth)
  app.use("/api/journey-builder", requireAuth, journeyBuilderRoutes);

  // Task Assignments routes (protected with auth)
  app.use("/api/task-assignments", requireAuth, taskAssignmentsRoutes);

  // Exports routes (protected with auth)
  app.use("/api/exports", requireAuth, exportsRoutes);

  // Knowledge Graph routes (protected with auth)
  app.use("/api/knowledge", requireAuth, knowledgeRoutes);

  // Marketing Consultant routes (protected with auth)
  app.use("/api/marketing-consultant", requireAuth, marketingConsultantRoutes);

  // Strategies Hub routes (protected with auth)
  app.use("/api/strategies", requireAuth, strategiesHubRoutes);

  // EPM CRUD routes (protected with auth)
  app.use("/api", requireAuth, epmCrudRoutes);

  // Ontology routes (protected with auth)
  app.use("/api/ontology", requireAuth, ontologyRoutes);

  // Module Registry routes (public for GUI composability)
  app.use("/api/module-registry", moduleRegistryRouter);

  // Custom Journey Builder routes (visual journey config CRUD - protected with auth)
  app.use("/api/custom-journey-builder", requireAuth, customJourneyBuilderRoutes);

  // Middleware to check roles (updated for Replit Auth)
  const requireRole = (roles: string[]) => async (req: any, res: any, next: any) => {
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: "Failed to verify permissions" });
    }
  };


  // Session Context API endpoints
  app.get("/api/session-context", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Try to get active journey session first (new journey-based system)
      const [activeJourney] = await db.select()
        .from(journeySessions)
        .where(
          and(
            eq(journeySessions.userId, userId),
            eq(journeySessions.status, 'in_progress')
          )
        )
        .orderBy(desc(journeySessions.updatedAt))
        .limit(1);

      if (activeJourney) {
        // Transform journey data into SessionContext format
        const accumulatedContext: any = activeJourney.accumulatedContext || {};
        const currentFramework = accumulatedContext.currentFramework || 'Unknown Framework';
        const completedFrameworks = activeJourney.completedFrameworks || [];
        const insights = accumulatedContext.insights || {};
        
        // Extract key insights from the accumulated context
        const keyInsights: string[] = [];
        if (insights.rootCauses && Array.isArray(insights.rootCauses)) {
          keyInsights.push(...insights.rootCauses.slice(0, 3));
        }
        if (insights.strategicImplications && Array.isArray(insights.strategicImplications)) {
          keyInsights.push(...insights.strategicImplications.slice(0, 2));
        }
        
        const sessionContext = {
          id: activeJourney.id,
          goal: `Strategic Analysis Journey: ${activeJourney.journeyType}`,
          successCriteria: [
            `✓ Complete ${currentFramework} analysis`,
            `${completedFrameworks.length} of ${(activeJourney.currentFrameworkIndex || 0) + 1} frameworks completed`,
            ...keyInsights.slice(0, 3).map(insight => `• ${insight}`)
          ],
          currentPhase: `Analyzing: ${currentFramework}`,
          decisionsLog: [],
          isActive: true,
          createdAt: activeJourney.createdAt,
          updatedAt: activeJourney.updatedAt
        };

        return res.json(sessionContext);
      }

      // No active journey - return null instead of falling back to old standalone sessions
      res.json(null);
    } catch (error) {
      console.error('[Session Context] Error:', error);
      res.status(500).json({ message: "Failed to fetch session context" });
    }
  });

  app.post("/api/session-context", requireAuth, async (req, res) => {
    try {
      const validatedData = insertSessionContextSchema.parse(req.body);
      const context = await storage.createSessionContext(validatedData);
      res.status(201).json(context);
    } catch (error) {
      res.status(400).json({ message: "Invalid session context data" });
    }
  });

  app.patch("/api/session-context/:id", requireAuth, async (req, res) => {
    try {
      // Validate that only allowed fields are being updated
      const allowedFields = ['goal', 'successCriteria', 'currentPhase', 'decisionsLog'];
      const updates = Object.keys(req.body);
      const invalidFields = updates.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(400).json({ message: `Invalid fields: ${invalidFields.join(', ')}` });
      }

      // Validate successCriteria if present
      if (req.body.successCriteria && !Array.isArray(req.body.successCriteria)) {
        return res.status(400).json({ message: "successCriteria must be an array" });
      }

      const context = await storage.updateSessionContext(req.params.id, req.body);
      res.json(context);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update session context" });
    }
  });

  app.post("/api/session-context/:id/decision", requireAuth, async (req, res) => {
    try {
      // Validate decision structure
      if (!req.body.decision || typeof req.body.decision !== 'string') {
        return res.status(400).json({ message: "decision (string) is required" });
      }

      const context = await storage.addDecisionToContext(req.params.id, {
        decision: req.body.decision,
        reason: req.body.reason || '',
      });
      res.json(context);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to add decision" });
    }
  });

  app.post("/api/session-context/:id/deactivate", requireAuth, async (req, res) => {
    try {
      await storage.deactivateSessionContext(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: "Failed to deactivate session context" });
    }
  });

  // Assessment API endpoints
  app.post("/api/assessment/program", requireAuth, async (req, res) => {
    try {
      const { program, relatedData } = req.body;
      if (!program) {
        return res.status(400).json({ message: "program data required" });
      }
      const assessment = await assessmentService.assessProgram(program, relatedData);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess program" });
    }
  });

  app.post("/api/assessment/task", requireAuth, async (req, res) => {
    try {
      const { task, program } = req.body;
      if (!task) {
        return res.status(400).json({ message: "task data required" });
      }
      const assessment = await assessmentService.assessTask(task, program);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess task" });
    }
  });

  app.post("/api/assessment/risk", requireAuth, async (req, res) => {
    try {
      const { risk, mitigations } = req.body;
      if (!risk) {
        return res.status(400).json({ message: "risk data required" });
      }
      const assessment = await assessmentService.assessRisk(risk, mitigations);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess risk" });
    }
  });

  app.post("/api/assessment/benefit", requireAuth, async (req, res) => {
    try {
      const { benefit, program } = req.body;
      if (!benefit) {
        return res.status(400).json({ message: "benefit data required" });
      }
      const assessment = await assessmentService.assessBenefit(benefit, program);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess benefit" });
    }
  });

  app.post("/api/assessment/resource", requireAuth, async (req, res) => {
    try {
      const { resource } = req.body;
      if (!resource) {
        return res.status(400).json({ message: "resource data required" });
      }
      const assessment = await assessmentService.assessResource(resource);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess resource" });
    }
  });

  app.post("/api/assessment/kpi", requireAuth, async (req, res) => {
    try {
      const { kpi, measurements } = req.body;
      if (!kpi) {
        return res.status(400).json({ message: "kpi data required" });
      }
      const assessment = await assessmentService.assessKpi(kpi, measurements);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess KPI" });
    }
  });

  // AI Orchestration Routes
  const orchestrator = new Orchestrator(storage);

  app.post("/api/orchestrator/task", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedTask = orchestratorTaskSchema.parse(req.body);
      const result = await orchestrator.processTask(validatedTask);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ 
        message: "Failed to process orchestration task", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/orchestrator/task/:id", requireAuth, async (req, res) => {
    try {
      const session = await storage.getSessionContextById(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post("/api/web-search", async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      const apiKey = process.env.BRAVE_SEARCH_API_KEY;
      if (!apiKey) {
        console.error('[WebSearch] BRAVE_SEARCH_API_KEY environment variable is not set');
        return res.status(503).json({ 
          error: 'External research is unavailable',
          details: 'The BRAVE_SEARCH_API_KEY is not configured in this environment. Please add it to enable web research capabilities.'
        });
      }

      const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
      searchUrl.searchParams.append('q', query);
      searchUrl.searchParams.append('count', '10');

      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Brave Search API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform Brave Search response to match expected format (Serper-like)
      const transformedData = {
        organic: (data.web?.results || []).map((result: any, index: number) => ({
          title: result.title || '',
          link: result.url || '',
          snippet: result.description || '',
          position: index + 1
        }))
      };

      res.json(transformedData);
    } catch (error) {
      console.error('Web search error:', error);
      res.status(500).json({ 
        error: 'Failed to perform web search',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  function extractPublicationDate(html: string): string | null {
    function extractDateFromObject(obj: any): string | null {
      const dateFields = ['datePublished', 'publishedDate', 'dateCreated', 'dateModified'];
      for (const field of dateFields) {
        if (obj[field]) {
          const parsedDate = new Date(obj[field]);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
      }
      return null;
    }

    function walkJsonLd(obj: any): string | null {
      if (!obj || typeof obj !== 'object') return null;
      
      const typeCheck = obj['@type'];
      if (typeCheck) {
        const types = Array.isArray(typeCheck) ? typeCheck : [typeCheck];
        const hasRelevantType = types.some((t: string) =>
          t && (
            t.includes('Article') || 
            t.includes('NewsArticle') || 
            t.includes('BlogPosting') ||
            t.includes('ScholarlyArticle') ||
            t.includes('CreativeWork')
          )
        );
        if (hasRelevantType) {
          const date = extractDateFromObject(obj);
          if (date) return date;
        }
      }
      
      if (Array.isArray(obj['@graph'])) {
        for (const item of obj['@graph']) {
          const date = walkJsonLd(item);
          if (date) return date;
        }
      }
      
      for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) {
          for (const item of obj[key]) {
            const date = walkJsonLd(item);
            if (date) return date;
          }
        } else if (typeof obj[key] === 'object') {
          const date = walkJsonLd(obj[key]);
          if (date) return date;
        }
      }
      
      return null;
    }

    const jsonLdMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
    for (const match of jsonLdMatches) {
      try {
        const jsonLd = JSON.parse(match[1]);
        const date = walkJsonLd(jsonLd);
        if (date) return date;
      } catch (e) {
        // JSON parsing failed, continue
      }
    }

    const metaPatterns = [
      /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*name=["'](?:publish|publication)(?:_|-)?date["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i,
      /<time[^>]*datetime=["']([^"']+)["']/i,
      /<meta[^>]*property=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
    ];

    for (const pattern of metaPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const dateStr = match[1];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      }
    }

    return null;
  }

  app.post("/api/web-fetch", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Premisia/1.0; +https://premisia.ai)'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const content = await response.text();
      const publicationDate = extractPublicationDate(content);
      
      res.json({ 
        content, 
        url,
        metadata: {
          publicationDate
        }
      });
    } catch (error) {
      console.error('Web fetch error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch URL',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Strategic Consultant Test Endpoint
  app.get("/api/strategy/test", requireAuth, async (req, res) => {
    try {
      const { strategyOntologyService } = await import("./ontology/strategy-ontology-service");
      
      // Test: Get all approaches
      const approachesRecord = strategyOntologyService.getStrategicApproaches();
      const approaches = Object.entries(approachesRecord).map(([id, approach]) => ({ 
        id, 
        name: approach.label 
      }));
      
      // Test: Get cost estimate for cost_leadership in UAE
      const costEstimate = strategyOntologyService.calculateCostEstimate('cost_leadership', 'uae');
      console.log('Cost Estimate Result:', costEstimate);
      
      // Test: Get workstream allocations
      const workstreams = strategyOntologyService.calculateWorkstreamAllocations('cost_leadership', 'uae');
      console.log('Workstreams Result:', workstreams);
      
      // Test: Validate coherence
      const coherence = strategyOntologyService.validateStrategicCoherence('cost_leadership', 'uae', { 
        has_regulatory_requirements: true 
      });
      console.log('Coherence Result:', coherence);
      
      // Test: Get decision options
      const decisionOptions = strategyOntologyService.getDecisionOptions('differentiation_service', 'usa');
      console.log('Decision Options Result:', decisionOptions);
      
      const responseData = {
        status: 'success',
        tests: {
          approaches,
          costEstimate,
          workstreams: workstreams.slice(0, 3),
          coherence,
          decisionOptions: decisionOptions ? {
            approach: decisionOptions.approach.label,
            market: decisionOptions.market.label,
            cost: decisionOptions.cost_estimate,
            workstreamCount: decisionOptions.workstreams.length,
            coherence: decisionOptions.coherence
          } : null
        }
      };
      
      console.log('Full Response Data:', JSON.stringify(responseData, null, 2));
      res.json(responseData);
    } catch (error) {
      console.error('Strategy Test Error:', error);
      res.status(500).json({ 
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // ============================================
  // Background Jobs Routes
  // ============================================
  
  // Get a specific job by ID
  app.get('/api/background-jobs/:id', isAuthenticated, async (req: any, res) => {
    try {
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const jobId = req.params.id;
      const userId = req.user.claims.sub;
      
      const job = await backgroundJobService.getJobById(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      // Ensure user owns this job (check before returning data)
      if (job.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      res.json({ job });
    } catch (error) {
      console.error('[Background Jobs] Error fetching job:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  });
  
  // Get all running jobs for current user
  app.get('/api/background-jobs/running', isAuthenticated, async (req: any, res) => {
    try {
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user.claims.sub;
      const jobs = await backgroundJobService.getRunningJobs(userId);
      res.json({ jobs });
    } catch (error) {
      console.error('[Background Jobs] Error fetching running jobs:', error);
      res.status(500).json({ error: 'Failed to fetch running jobs' });
    }
  });
  
  // Get job by session ID
  app.get('/api/background-jobs/by-session/:sessionId', isAuthenticated, async (req: any, res) => {
    try {
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const sessionId = req.params.sessionId;
      const userId = req.user.claims.sub;
      
      const job = await backgroundJobService.getJobBySession(sessionId);
      
      if (!job) {
        return res.json({ job: null });
      }
      
      // Ensure user owns this job (check before returning data)
      if (job.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      res.json({ job });
    } catch (error) {
      console.error('[Background Jobs] Error fetching job by session:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  });
  
  // Get recent jobs for current user
  app.get('/api/background-jobs/recent', isAuthenticated, async (req: any, res) => {
    try {
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const jobs = await backgroundJobService.getRecentJobs(userId, limit);
      res.json({ jobs });
    } catch (error) {
      console.error('[Background Jobs] Error fetching recent jobs:', error);
      res.status(500).json({ error: 'Failed to fetch recent jobs' });
    }
  });
  
  // Get recently completed jobs (for notifications)
  app.get('/api/background-jobs/recent-completions', isAuthenticated, async (req: any, res) => {
    try {
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user.claims.sub;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // Get jobs completed in the last 5 minutes
      const jobs = await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.userId, userId),
            or(
              eq(backgroundJobs.status, 'completed'),
              eq(backgroundJobs.status, 'failed')
            ),
            or(
              and(
                eq(backgroundJobs.status, 'completed'),
                sql`${backgroundJobs.completedAt} >= ${fiveMinutesAgo}`
              ),
              and(
                eq(backgroundJobs.status, 'failed'),
                sql`${backgroundJobs.failedAt} >= ${fiveMinutesAgo}`
              )
            )
          )
        )
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(5);
      
      res.json({ jobs });
    } catch (error: any) {
      console.error('Error fetching recent completions:', error);
      res.status(500).json({ error: 'Failed to fetch recent completions' });
    }
  });
  
  // Get all jobs for current user (with optional status filter)
  app.get('/api/background-jobs', isAuthenticated, async (req: any, res) => {
    try {
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user.claims.sub;
      const status = req.query.status as 'pending' | 'running' | 'completed' | 'failed' | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const jobs = await backgroundJobService.getJobsByUser(userId, { status, limit });
      res.json({ jobs });
    } catch (error) {
      console.error('[Background Jobs] Error fetching user jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });
  
  // Cancel a running job
  app.delete('/api/background-jobs/:id', isAuthenticated, async (req: any, res) => {
    try {
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const jobId = req.params.id;
      const userId = req.user.claims.sub;
      
      const cancelled = await backgroundJobService.cancelJob(jobId, userId);
      
      if (!cancelled) {
        return res.status(400).json({ error: 'Unable to cancel job. Job may not exist, belong to another user, or already be completed.' });
      }
      
      res.json({ success: true, message: 'Job cancelled successfully' });
    } catch (error) {
      console.error('[Background Jobs] Error cancelling job:', error);
      res.status(500).json({ error: 'Failed to cancel job' });
    }
  });
  
  // Cleanup old completed/failed jobs
  app.post('/api/background-jobs/cleanup', isAuthenticated, async (req: any, res) => {
    try {
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const daysOld = req.body.daysOld || 7;
      
      // Validate daysOld is a reasonable number
      if (daysOld < 1 || daysOld > 365) {
        return res.status(400).json({ error: 'daysOld must be between 1 and 365' });
      }
      
      const deletedCount = await backgroundJobService.cleanupOldJobs(daysOld);
      
      res.json({ 
        success: true, 
        message: `Cleaned up ${deletedCount} old jobs`,
        deletedCount 
      });
    } catch (error) {
      console.error('[Background Jobs] Error cleaning up jobs:', error);
      res.status(500).json({ error: 'Failed to cleanup jobs' });
    }
  });

  // ===== Golden Records API (Admin Only) =====
  
  // Create a new golden record
  app.post('/api/admin/golden-records', requireAuth, requireRole(['Admin']), async (req: any, res) => {
    try {
      const { journeyType, notes, steps, metadata, promoteAsCurrent, parentVersion } = req.body;
      
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!journeyType || !steps) {
        return res.status(400).json({ error: 'Missing required fields: journeyType, steps' });
      }
      
      const record = await storage.createGoldenRecord({
        journeyType,
        notes,
        steps,
        metadata,
        createdBy: req.user.claims.sub,
        parentVersion,
        promoteAsCurrent: promoteAsCurrent || false,
      });
      
      res.status(201).json(record);
    } catch (error) {
      console.error('[Golden Records] Error creating golden record:', error);
      res.status(500).json({ error: 'Failed to create golden record' });
    }
  });
  
  // List golden records (with optional filters)
  app.get('/api/admin/golden-records', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
      const journeyType = req.query.journeyType as string | undefined;
      const includeHistory = req.query.includeHistory === 'true';
      
      const records = await storage.listGoldenRecords(journeyType, includeHistory);
      res.json(records);
    } catch (error) {
      console.error('[Golden Records] Error listing golden records:', error);
      res.status(500).json({ error: 'Failed to list golden records' });
    }
  });
  
  // Get a specific golden record by journey type and version
  app.get('/api/admin/golden-records/:journeyType/:version', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
      const { journeyType, version } = req.params;
      const versionNumber = parseInt(version, 10);
      
      if (isNaN(versionNumber)) {
        return res.status(400).json({ error: 'Invalid version number' });
      }
      
      const record = await storage.getGoldenRecord(journeyType, versionNumber);
      
      if (!record) {
        return res.status(404).json({ error: 'Golden record not found' });
      }
      
      res.json(record);
    } catch (error) {
      console.error('[Golden Records] Error getting golden record:', error);
      res.status(500).json({ error: 'Failed to get golden record' });
    }
  });
  
  // Promote a golden record version to current
  app.post('/api/admin/golden-records/:journeyType/:version/promote', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
      const { journeyType, version } = req.params;
      const versionNumber = parseInt(version, 10);
      
      if (isNaN(versionNumber)) {
        return res.status(400).json({ error: 'Invalid version number' });
      }
      
      const promoted = await storage.promoteGoldenRecord(journeyType, versionNumber);
      
      if (!promoted) {
        return res.status(404).json({ error: 'Golden record not found' });
      }
      
      res.json(promoted);
    } catch (error) {
      console.error('[Golden Records] Error promoting golden record:', error);
      res.status(500).json({ error: 'Failed to promote golden record' });
    }
  });
  
  // Compare two golden record versions
  app.post('/api/admin/golden-records/:journeyType/:version/compare', requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
      const { journeyType, version } = req.params;
      const { compareToVersion } = req.body;
      
      const version1 = parseInt(version, 10);
      const version2 = parseInt(compareToVersion, 10);
      
      if (isNaN(version1) || isNaN(version2)) {
        return res.status(400).json({ error: 'Invalid version numbers' });
      }
      
      const comparison = await storage.compareGoldenRecords(journeyType, version1, version2);
      res.json(comparison);
    } catch (error) {
      console.error('[Golden Records] Error comparing golden records:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to compare golden records' });
    }
  });

  // ===== Encryption Migration API (Admin Only, One-Time Use) =====
  
  // Run encryption migration on legacy plaintext data
  app.post('/api/admin/encrypt-legacy-data', requireAuth, requireRole(['Admin']), async (req: any, res) => {
    try {
      const { passphrase, dryRun = true } = req.body;
      
      // Validate auth claims exist
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Require passphrase for security (prevents accidental execution)
      const requiredPassphrase = process.env.ENCRYPTION_MIGRATION_PASSPHRASE;
      if (!requiredPassphrase) {
        console.error('[Encryption Migration] ENCRYPTION_MIGRATION_PASSPHRASE not set');
        return res.status(500).json({ 
          error: 'Migration endpoint not configured. Set ENCRYPTION_MIGRATION_PASSPHRASE environment variable.' 
        });
      }
      
      if (!passphrase || passphrase !== requiredPassphrase) {
        console.warn(`[Encryption Migration] Invalid passphrase attempt by user ${req.user.claims.sub}`);
        return res.status(403).json({ error: 'Invalid passphrase' });
      }
      
      console.log(`[Encryption Migration] Starting migration - User: ${req.user.claims.sub}, DryRun: ${dryRun}`);
      
      // Import migration service
      const { runEncryptionMigration } = await import('./services/encryption-migration');
      
      // Run migration
      const stats = await runEncryptionMigration({
        dryRun,
        batchSize: 50
      });
      
      const response = {
        success: true,
        dryRun,
        stats: {
          totalRecords: stats.total,
          recordsEncrypted: stats.encrypted,
          recordsSkipped: stats.skipped,
          recordsFailed: stats.failed,
          durationMs: stats.duration
        },
        message: dryRun 
          ? 'Dry run completed. No data was modified.' 
          : stats.failed > 0
            ? `Migration completed with ${stats.failed} failures. Check logs for details.`
            : 'All plaintext data has been encrypted successfully!',
        executedBy: req.user.claims.sub,
        executedAt: new Date().toISOString()
      };
      
      console.log('[Encryption Migration] Results:', response);
      
      res.json(response);
    } catch (error) {
      console.error('[Encryption Migration] Error running migration:', error);
      res.status(500).json({ 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
