import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = './docs/screenshots';
const OUTPUT_FILE = './docs/premisia-complete-walkthrough.html';

function imageToBase64(filepath) {
  try {
    const data = fs.readFileSync(filepath);
    const ext = path.extname(filepath).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch (e) {
    console.log(`Warning: Could not load ${filepath}`);
    return '';
  }
}

function loadScreenshots() {
  const screenshots = {};
  
  const screenshotMapping = {
    marketingInput: '01-marketing-consultant-input.png',
    segmentBeachhead: '02-segment-results-beachhead.png',
    segmentTop20: '03-segment-results-top20.png',
    segmentGeneLibrary: '04-segment-results-genelibrary.png',
    myDiscoveries: '05-my-discoveries.png',
    strategicInput: '06-strategic-consultant-input.png',
    journeyHub: '07-journey-hub.png',
    programsList: '08-programs-list.png',
    epmOverview: '09-epm-overview.png',
    epmResources: '10-epm-resources.png',
    epmRisks: '11-epm-risks.png',
    epmKpis: '12-epm-kpis.png',
  };

  for (const [key, filename] of Object.entries(screenshotMapping)) {
    const filepath = path.join(SCREENSHOT_DIR, filename);
    if (fs.existsSync(filepath)) {
      screenshots[key] = imageToBase64(filepath);
      console.log(`✓ Loaded ${filename}`);
    } else {
      console.log(`✗ Missing ${filename}`);
      screenshots[key] = '';
    }
  }

  return screenshots;
}

function generateHTML(screenshots) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Premisia - Complete Feature Walkthrough</title>
    <style>
        :root {
            --primary: #1a1a2e;
            --secondary: #16213e;
            --accent: #e94560;
            --accent-light: #ff6b6b;
            --success: #10b981;
            --warning: #f59e0b;
            --light: #f8fafc;
            --dark: #0f172a;
            --border: #e2e8f0;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            line-height: 1.7;
            color: #334155;
            background: #fff;
        }

        .hero {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 50%, #0f3460 100%);
            color: white;
            padding: 120px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .hero::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: radial-gradient(circle at 30% 70%, rgba(233, 69, 96, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 70% 30%, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
        }
        
        .hero > * { position: relative; z-index: 1; }
        .hero h1 { font-size: 4.5rem; font-weight: 800; margin-bottom: 16px; letter-spacing: -3px; }
        .hero .tagline { font-size: 2rem; opacity: 0.95; font-weight: 300; margin-bottom: 24px; }
        .hero .subtitle { font-size: 1.25rem; max-width: 700px; margin: 0 auto; opacity: 0.85; line-height: 1.8; }

        .container { max-width: 1200px; margin: 0 auto; padding: 0 40px; }
        
        .toc {
            background: var(--light);
            padding: 60px 0;
            border-bottom: 1px solid var(--border);
        }
        
        .toc h2 { text-align: center; margin-bottom: 40px; color: var(--primary); font-size: 2rem; }
        
        .toc-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
        }
        
        .toc-card {
            background: white;
            border-radius: 16px;
            padding: 28px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            border: 1px solid var(--border);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .toc-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        }
        
        .toc-card .stage-badge {
            display: inline-block;
            background: var(--accent);
            color: white;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .toc-card h3 { font-size: 1.25rem; color: var(--primary); margin-bottom: 8px; }
        .toc-card p { font-size: 0.95rem; color: #64748b; margin-bottom: 16px; }
        .toc-card ul { list-style: none; font-size: 0.9rem; color: #475569; }
        .toc-card ul li { padding: 4px 0; padding-left: 20px; position: relative; }
        .toc-card ul li::before { content: "→"; position: absolute; left: 0; color: var(--accent); }

        section { padding: 100px 0; }
        section:nth-child(odd) { background: var(--light); }
        
        .section-header {
            display: flex;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 40px;
        }
        
        .section-number {
            width: 72px; height: 72px;
            background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
            color: white;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            font-weight: 700;
            flex-shrink: 0;
        }
        
        .section-title h2 { font-size: 2.5rem; color: var(--primary); margin-bottom: 8px; }
        .section-title .route { 
            font-family: 'SF Mono', Consolas, monospace; 
            font-size: 0.95rem; 
            color: #64748b; 
            background: #f1f5f9;
            padding: 6px 12px;
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 12px;
        }
        .section-title p { font-size: 1.15rem; color: #64748b; max-width: 600px; }
        
        .screenshot-container {
            margin: 40px 0;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 40px rgba(0,0,0,0.12);
            border: 1px solid var(--border);
        }
        
        .screenshot-container img {
            width: 100%;
            display: block;
        }
        
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            margin: 40px 0;
        }
        
        .feature-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            border: 1px solid var(--border);
        }
        
        section:nth-child(odd) .feature-card { background: #fff; }
        section:nth-child(even) .feature-card { background: var(--light); }
        
        .feature-card h4 {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 1.1rem;
            color: var(--primary);
            margin-bottom: 12px;
        }
        
        .feature-card h4 .icon {
            width: 32px; height: 32px;
            background: linear-gradient(135deg, var(--accent-light) 0%, var(--accent) 100%);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
        }
        
        .feature-card p { font-size: 0.95rem; color: #64748b; }

        .steps-list {
            background: white;
            border-radius: 12px;
            padding: 32px;
            border: 1px solid var(--border);
            margin: 40px 0;
        }
        
        section:nth-child(odd) .steps-list { background: #fff; }
        
        .steps-list h4 { font-size: 1.1rem; color: var(--primary); margin-bottom: 20px; }
        .steps-list ol { padding-left: 24px; }
        .steps-list ol li { padding: 8px 0; font-size: 1rem; color: #475569; }
        .steps-list ol li::marker { color: var(--accent); font-weight: 600; }

        .callout {
            background: linear-gradient(135deg, rgba(233, 69, 96, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%);
            border-left: 4px solid var(--accent);
            padding: 24px 28px;
            border-radius: 0 12px 12px 0;
            margin: 32px 0;
        }
        
        .callout h4 { color: var(--accent); margin-bottom: 8px; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; }
        .callout p { color: #475569; font-size: 1rem; }

        .comparison-section {
            background: linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            padding: 100px 0;
        }
        
        .comparison-section h2 { text-align: center; margin-bottom: 60px; font-size: 2.5rem; }
        
        .comparison-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 40px;
        }
        
        .comparison-column h3 {
            font-size: 1.5rem;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid rgba(255,255,255,0.2);
        }
        
        .comparison-column.without h3 { color: #f87171; }
        .comparison-column.with h3 { color: #34d399; }
        
        .comparison-column ul { list-style: none; }
        .comparison-column ul li {
            padding: 12px 0;
            padding-left: 32px;
            position: relative;
            font-size: 1.05rem;
            opacity: 0.9;
        }
        
        .comparison-column.without ul li::before { content: "✗"; position: absolute; left: 0; color: #f87171; }
        .comparison-column.with ul li::before { content: "✓"; position: absolute; left: 0; color: #34d399; }

        footer {
            background: var(--dark);
            color: rgba(255,255,255,0.6);
            text-align: center;
            padding: 40px;
        }
        
        footer p { font-size: 0.95rem; }

        @media (max-width: 900px) {
            .hero h1 { font-size: 3rem; }
            .toc-grid { grid-template-columns: 1fr; }
            .feature-grid { grid-template-columns: 1fr; }
            .comparison-grid { grid-template-columns: 1fr; }
            .section-header { flex-direction: column; }
        }
    </style>
</head>
<body>
    <header class="hero">
        <h1>Premisia</h1>
        <p class="tagline">Think it through.</p>
        <p class="subtitle">The AI-enhanced platform that transforms strategic vision into executable programs. From identifying ideal customers to building fully accountable project plans.</p>
    </header>

    <nav class="toc">
        <div class="container">
            <h2>Complete Feature Walkthrough</h2>
            <div class="toc-grid">
                <div class="toc-card">
                    <span class="stage-badge">Stage 1</span>
                    <h3>Marketing Consultant</h3>
                    <p>Systematic customer segment discovery using AI-powered gene library analysis.</p>
                    <ul>
                        <li>Input Page</li>
                        <li>Beachhead Analysis</li>
                        <li>Top 20 Segments</li>
                        <li>Gene Library</li>
                        <li>My Discoveries</li>
                    </ul>
                </div>
                <div class="toc-card">
                    <span class="stage-badge">Stage 2</span>
                    <h3>Strategic Consultant</h3>
                    <p>Deep strategic analysis using proven frameworks with anti-confirmation bias.</p>
                    <ul>
                        <li>Strategic Input</li>
                        <li>Journey Hub</li>
                        <li>Framework Analysis</li>
                    </ul>
                </div>
                <div class="toc-card">
                    <span class="stage-badge">Stage 3</span>
                    <h3>Strategy Workspace</h3>
                    <p>Convert strategic decisions into executable programs with full accountability.</p>
                    <ul>
                        <li>Programs List</li>
                        <li>EPM Overview</li>
                        <li>Resources & Risks</li>
                        <li>KPIs Tracking</li>
                    </ul>
                </div>
            </div>
        </div>
    </nav>

    <!-- Section 1: Marketing Consultant Input -->
    <section id="marketing-input">
        <div class="container">
            <div class="section-header">
                <div class="section-number">1</div>
                <div class="section-title">
                    <span class="route">/marketing-consultant</span>
                    <h2>Marketing Consultant Input</h2>
                    <p>Begin your customer discovery journey by describing your product or service. Upload supporting documents for deeper AI analysis.</p>
                </div>
            </div>
            
            ${screenshots.marketingInput ? `
            <div class="screenshot-container">
                <img src="${screenshots.marketingInput}" alt="Marketing Consultant Input Page">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">📝</span> Natural Language Input</h4>
                    <p>Describe your product or service in plain language. The AI understands context, value propositions, and market positioning.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">📎</span> Document Upload</h4>
                    <p>Upload PDFs, Word docs, Excel files, or images. AI extracts insights to enhance your analysis.</p>
                </div>
            </div>
            
            <div class="callout">
                <h4>Pro Tip</h4>
                <p>Be specific about what problem you solve and for whom. The more detail you provide, the more targeted your segment discovery will be.</p>
            </div>
        </div>
    </section>

    <!-- Section 2: Segment Discovery - Beachhead -->
    <section id="segment-beachhead">
        <div class="container">
            <div class="section-header">
                <div class="section-number">2</div>
                <div class="section-title">
                    <span class="route">/marketing-consultant/results/:id</span>
                    <h2>Segment Discovery: Beachhead Analysis</h2>
                    <p>Your recommended first-target customer segment with detailed rationale and validation experiments.</p>
                </div>
            </div>
            
            ${screenshots.segmentBeachhead ? `
            <div class="screenshot-container">
                <img src="${screenshots.segmentBeachhead}" alt="Segment Discovery - Beachhead Analysis">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">🎯</span> Beachhead Recommendation</h4>
                    <p>AI-synthesized recommendation for which customer segment to target first, based on fit scores across 8 dimensions.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">🧪</span> Validation Experiments</h4>
                    <p>Specific experiments to validate your beachhead choice before committing significant resources.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">📊</span> Fit Score Breakdown</h4>
                    <p>See how the segment scores on pain intensity, decision-maker access, budget match, competition, and more.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">💡</span> Strategic Rationale</h4>
                    <p>Understand why this segment is recommended with evidence-backed reasoning.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 3: Top 20 Segments -->
    <section id="segment-top20">
        <div class="container">
            <div class="section-header">
                <div class="section-number">3</div>
                <div class="section-title">
                    <span class="route">/marketing-consultant/results/:id → Top 20 Segments Tab</span>
                    <h2>Top 20 Customer Segments</h2>
                    <p>Ranked list of your highest-potential customer segments with detailed genome profiles.</p>
                </div>
            </div>
            
            ${screenshots.segmentTop20 ? `
            <div class="screenshot-container">
                <img src="${screenshots.segmentTop20}" alt="Top 20 Customer Segments">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="steps-list">
                <h4>What You'll Find Here</h4>
                <ol>
                    <li><strong>Ranked Segments:</strong> Top 20 segments sorted by total fit score (max 40 points)</li>
                    <li><strong>Genome Details:</strong> Each segment's unique combination of 8 dimensional genes</li>
                    <li><strong>Fitness Scores:</strong> Individual scores for pain, access, budget, competition, fit, urgency, scale, and GTM efficiency</li>
                    <li><strong>Narrative Reasons:</strong> AI-generated explanations for why each segment ranks where it does</li>
                </ol>
            </div>
        </div>
    </section>

    <!-- Section 4: Gene Library -->
    <section id="gene-library">
        <div class="container">
            <div class="section-header">
                <div class="section-number">4</div>
                <div class="section-title">
                    <span class="route">/marketing-consultant/results/:id → Gene Library Tab</span>
                    <h2>Gene Library</h2>
                    <p>The complete catalog of dimensional values used to construct customer segment genomes.</p>
                </div>
            </div>
            
            ${screenshots.segmentGeneLibrary ? `
            <div class="screenshot-container">
                <img src="${screenshots.segmentGeneLibrary}" alt="Gene Library">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">🏭</span> Industry Vertical</h4>
                    <p>All industry categories identified for your solution: SaaS, Healthcare, FinTech, Manufacturing, and more.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">📏</span> Company Size</h4>
                    <p>From startups to enterprises: SMB, Mid-Market, Enterprise, Fortune 500 classifications.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">👤</span> Decision Maker</h4>
                    <p>Key buyer personas: CTO, VP of Engineering, Product Manager, Operations Director, etc.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">⚡</span> Purchase Trigger</h4>
                    <p>Events that drive buying: Digital transformation, scaling pain, compliance requirements, competitive pressure.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 5: My Discoveries -->
    <section id="my-discoveries">
        <div class="container">
            <div class="section-header">
                <div class="section-number">5</div>
                <div class="section-title">
                    <span class="route">/marketing-consultant/discoveries</span>
                    <h2>My Discoveries</h2>
                    <p>Your personal library of all segment discovery analyses with quick access to results.</p>
                </div>
            </div>
            
            ${screenshots.myDiscoveries ? `
            <div class="screenshot-container">
                <img src="${screenshots.myDiscoveries}" alt="My Discoveries">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">📚</span> Discovery History</h4>
                    <p>All your past segment discovery analyses in one place, with dates and status indicators.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">🔄</span> Quick Resume</h4>
                    <p>Instantly return to any previous analysis to review results or continue to strategic planning.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 6: Strategic Consultant Input -->
    <section id="strategic-input">
        <div class="container">
            <div class="section-header">
                <div class="section-number">6</div>
                <div class="section-title">
                    <span class="route">/strategic-consultant</span>
                    <h2>Strategic Consultant Input</h2>
                    <p>Define your strategic challenge or continue from segment discovery with pre-filled context.</p>
                </div>
            </div>
            
            ${screenshots.strategicInput ? `
            <div class="screenshot-container">
                <img src="${screenshots.strategicInput}" alt="Strategic Consultant Input">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">🔗</span> Segment Discovery Handoff</h4>
                    <p>When coming from Marketing Consultant, your beachhead insights are automatically included.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">🎯</span> Strategic Challenge</h4>
                    <p>Define the strategic question you want to explore: market entry, competitive positioning, growth strategy.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 7: Journey Hub -->
    <section id="journey-hub">
        <div class="container">
            <div class="section-header">
                <div class="section-number">7</div>
                <div class="section-title">
                    <span class="route">/journeys</span>
                    <h2>Journey Hub</h2>
                    <p>Select from proven strategic frameworks or build custom analysis journeys.</p>
                </div>
            </div>
            
            ${screenshots.journeyHub ? `
            <div class="screenshot-container">
                <img src="${screenshots.journeyHub}" alt="Journey Hub">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">❓</span> Five Whys</h4>
                    <p>Root cause analysis that digs deep into problems to uncover fundamental issues.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">⚔️</span> Porter's Five Forces</h4>
                    <p>Competitive landscape analysis: suppliers, buyers, substitutes, new entrants, rivalry.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">📋</span> Business Model Canvas</h4>
                    <p>Complete 9-block business model design with cross-block consistency validation.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">🌍</span> PESTLE Analysis</h4>
                    <p>Macro-environmental scanning: Political, Economic, Social, Technological, Legal, Environmental.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 8: Programs List -->
    <section id="programs-list">
        <div class="container">
            <div class="section-header">
                <div class="section-number">8</div>
                <div class="section-title">
                    <span class="route">/strategy-workspace/programs</span>
                    <h2>Programs List</h2>
                    <p>All your EPM programs converted from strategic decisions, ready for execution tracking.</p>
                </div>
            </div>
            
            ${screenshots.programsList ? `
            <div class="screenshot-container">
                <img src="${screenshots.programsList}" alt="Programs List">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">📊</span> Program Overview</h4>
                    <p>See all programs at a glance with status indicators, progress metrics, and key dates.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">🔍</span> Quick Access</h4>
                    <p>One-click access to detailed program views with full EPM dashboard capabilities.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 9: EPM Overview -->
    <section id="epm-overview">
        <div class="container">
            <div class="section-header">
                <div class="section-number">9</div>
                <div class="section-title">
                    <span class="route">/strategy-workspace/epm/:id</span>
                    <h2>EPM Program Overview</h2>
                    <p>The central dashboard for managing your strategic initiative as an executable program.</p>
                </div>
            </div>
            
            ${screenshots.epmOverview ? `
            <div class="screenshot-container">
                <img src="${screenshots.epmOverview}" alt="EPM Program Overview">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">📈</span> Program Status</h4>
                    <p>Real-time health indicators showing overall progress, blockers, and critical path status.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">📅</span> Timeline View</h4>
                    <p>Gantt-style visualization of workstreams, milestones, and dependencies.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">👥</span> Team Allocation</h4>
                    <p>See who's working on what with capacity utilization and workload balance.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">🎯</span> Key Metrics</h4>
                    <p>Budget burn, schedule variance, and other critical program health indicators.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 10: EPM Resources -->
    <section id="epm-resources">
        <div class="container">
            <div class="section-header">
                <div class="section-number">10</div>
                <div class="section-title">
                    <span class="route">/strategy-workspace/epm/:id → Resources Tab</span>
                    <h2>EPM Resources</h2>
                    <p>Complete resource allocation view with team members, capacity, and assignment tracking.</p>
                </div>
            </div>
            
            ${screenshots.epmResources ? `
            <div class="screenshot-container">
                <img src="${screenshots.epmResources}" alt="EPM Resources">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">👤</span> Resource Profiles</h4>
                    <p>Team member details including role, skills, availability, and current assignments.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">⚖️</span> Workload Balance</h4>
                    <p>Visual indicators showing over-allocation risks and capacity optimization opportunities.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 11: EPM Risks -->
    <section id="epm-risks">
        <div class="container">
            <div class="section-header">
                <div class="section-number">11</div>
                <div class="section-title">
                    <span class="route">/strategy-workspace/epm/:id → Risks Tab</span>
                    <h2>EPM Risks</h2>
                    <p>Complete risk register with probability, impact, mitigation strategies, and status tracking.</p>
                </div>
            </div>
            
            ${screenshots.epmRisks ? `
            <div class="screenshot-container">
                <img src="${screenshots.epmRisks}" alt="EPM Risks">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">⚠️</span> Risk Assessment</h4>
                    <p>Probability × Impact scoring with visual risk heat mapping for prioritization.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">🛡️</span> Mitigation Plans</h4>
                    <p>Documented response strategies, owners, and trigger conditions for each risk.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 12: EPM KPIs -->
    <section id="epm-kpis">
        <div class="container">
            <div class="section-header">
                <div class="section-number">12</div>
                <div class="section-title">
                    <span class="route">/strategy-workspace/epm/:id → KPIs Tab</span>
                    <h2>EPM KPIs</h2>
                    <p>Key performance indicators tracking with targets, actuals, and trend visualization.</p>
                </div>
            </div>
            
            ${screenshots.epmKpis ? `
            <div class="screenshot-container">
                <img src="${screenshots.epmKpis}" alt="EPM KPIs">
            </div>
            ` : '<p class="callout"><strong>Screenshot pending</strong></p>'}
            
            <div class="feature-grid">
                <div class="feature-card">
                    <h4><span class="icon">📊</span> KPI Dashboard</h4>
                    <p>Real-time performance metrics with target vs. actual comparisons and trend indicators.</p>
                </div>
                <div class="feature-card">
                    <h4><span class="icon">📈</span> Progress Tracking</h4>
                    <p>Historical data visualization showing KPI performance over the program lifecycle.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Comparison Section -->
    <div class="comparison-section">
        <div class="container">
            <h2>The Premisia Difference</h2>
            <div class="comparison-grid">
                <div class="comparison-column without">
                    <h3>Without Premisia</h3>
                    <ul>
                        <li>Weeks of manual strategic analysis</li>
                        <li>Gut-feel market targeting</li>
                        <li>Siloed framework analysis</li>
                        <li>Confirmation bias unchecked</li>
                        <li>Strategy decks gather dust</li>
                        <li>No execution accountability</li>
                    </ul>
                </div>
                <div class="comparison-column with">
                    <h3>With Premisia</h3>
                    <ul>
                        <li>Minutes of AI-enhanced analysis</li>
                        <li>Systematic 100+ segment evaluation</li>
                        <li>Integrated frameworks with handoffs</li>
                        <li>Built-in contradiction detection</li>
                        <li>Executable EPM programs</li>
                        <li>Full resource and KPI tracking</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <footer>
        <p>© 2026 Premisia. Think it through. • Complete Feature Walkthrough • Generated ${new Date().toLocaleDateString()}</p>
    </footer>
</body>
</html>`;
}

function main() {
  console.log('🏗️  Building Premisia Complete Walkthrough');
  console.log('==========================================\n');

  console.log('📷 Loading screenshots from:', SCREENSHOT_DIR);
  const screenshots = loadScreenshots();

  console.log('\n📄 Generating HTML...');
  const html = generateHTML(screenshots);

  console.log('💾 Writing to:', OUTPUT_FILE);
  fs.writeFileSync(OUTPUT_FILE, html);

  console.log('\n✅ Complete walkthrough generated successfully!');
  console.log(`📁 Output: ${OUTPUT_FILE}`);
  
  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`📊 File size: ${(stats.size / 1024).toFixed(1)} KB`);
}

main();
