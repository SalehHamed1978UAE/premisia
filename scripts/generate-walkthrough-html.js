import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = './docs/screenshots';
const OUTPUT_FILE = './docs/premisia-walkthrough.html';

function imageToBase64(filepath) {
  try {
    const data = fs.readFileSync(filepath);
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch (e) {
    console.log(`Warning: Could not load ${filepath}`);
    return '';
  }
}

function getScreenshot(name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  if (fs.existsSync(filepath)) {
    return imageToBase64(filepath);
  }
  return '';
}

const sections = [
  {
    id: 'landing',
    title: 'Welcome to Premisia',
    subtitle: 'AI-Enhanced Enterprise Program Management',
    screenshot: '00-landing',
    stage: null,
    description: `
      <p><strong>Premisia</strong> transforms strategic vision into executable programs. Our tagline says it all: <em>"Think it through."</em></p>
      <p>The platform bridges the gap between "I have this idea" and "here's exactly how we execute it" through three connected stages:</p>
      <ul>
        <li><strong>Stage 1: Marketing Consultant</strong> — WHO to target</li>
        <li><strong>Stage 2: Strategic Consultant</strong> — HOW to compete</li>
        <li><strong>Stage 3: Strategy Workspace</strong> — Execute the plan</li>
      </ul>
    `
  },
  {
    id: 'marketing-input',
    title: 'Marketing Consultant Input',
    subtitle: 'Describe your product or service',
    screenshot: '01-marketing-input',
    stage: 1,
    description: `
      <p>Start your journey by describing your product or service. The AI analyzes your input to understand:</p>
      <ul>
        <li>Industry category and business model type</li>
        <li>Key value propositions</li>
        <li>Target market characteristics</li>
      </ul>
      <p>You can also upload supporting documents (PDF, DOCX, Excel, images) for richer context.</p>
    `
  },
  {
    id: 'segment-discovery',
    title: 'Segment Discovery Results',
    subtitle: '8 Dimensions & 100+ Customer Genomes',
    screenshot: '02-segment-discovery',
    stage: 1,
    description: `
      <p>The Segment Discovery analysis provides comprehensive market insights across <strong>8 key dimensions</strong>:</p>
      <div class="dimensions-grid">
        <div class="dim-card"><span class="dim-icon">🏭</span> Industry</div>
        <div class="dim-card"><span class="dim-icon">📊</span> Company Size</div>
        <div class="dim-card"><span class="dim-icon">🌍</span> Geography</div>
        <div class="dim-card"><span class="dim-icon">💻</span> Technology Adoption</div>
        <div class="dim-card"><span class="dim-icon">😰</span> Pain Points</div>
        <div class="dim-card"><span class="dim-icon">🛒</span> Buying Behavior</div>
        <div class="dim-card"><span class="dim-icon">⚔️</span> Competition Exposure</div>
        <div class="dim-card"><span class="dim-icon">📈</span> Growth Potential</div>
      </div>
      <p>The <strong>Genome List</strong> presents 80-100+ customer segment candidates with fit scores, ranked by potential.</p>
      <p>The <strong>Beachhead Recommendation</strong> synthesizes findings into an actionable first target market, complete with a validation plan.</p>
    `
  },
  {
    id: 'strategic-input',
    title: 'Strategic Consultant Input',
    subtitle: 'Define your strategic challenge',
    screenshot: '03-strategic-input',
    stage: 2,
    description: `
      <p>Enter your strategic challenge or business question. If you're coming from Segment Discovery, insights are automatically pre-filled.</p>
      <p>The Strategic Consultant supports multiple analysis frameworks:</p>
      <ul>
        <li><strong>Five Whys</strong> — Root cause analysis</li>
        <li><strong>Porter's Five Forces</strong> — Competitive landscape</li>
        <li><strong>Business Model Canvas</strong> — 9-block model design</li>
        <li><strong>PESTLE</strong> — Macro-environmental scanning</li>
      </ul>
    `
  },
  {
    id: 'journey-hub',
    title: 'Journey Hub',
    subtitle: 'Choose your strategic journey',
    screenshot: '04-journey-hub',
    stage: 2,
    description: `
      <p>The Journey Hub is your command center for strategic analysis. Select from pre-built journeys or create custom analysis sequences.</p>
      <p>Each journey combines multiple frameworks for comprehensive insights. The AI handles research, analysis, and synthesis automatically.</p>
      <p><strong>Key features:</strong></p>
      <ul>
        <li>Pre-configured analysis sequences</li>
        <li>Background AI processing</li>
        <li>Real-time progress tracking</li>
        <li>Handoff to Strategy Workspace</li>
      </ul>
    `
  },
  {
    id: 'journey-results',
    title: 'Strategic Journey Results',
    subtitle: 'BMI Analysis Complete',
    screenshot: '05-journey-results',
    stage: 2,
    description: `
      <p>Journey results present comprehensive strategic analysis with:</p>
      <ul>
        <li><strong>Business Model Canvas</strong> — Full 9-block visualization</li>
        <li><strong>Research Evidence</strong> — Citations and sources for each insight</li>
        <li><strong>Contradiction Detection</strong> — Built-in bias checking</li>
        <li><strong>Strategic Decisions</strong> — Extracted actionable recommendations</li>
      </ul>
      <p>All findings are grounded in real research, with confidence scores and provenance tracking.</p>
    `
  },
  {
    id: 'programs-list',
    title: 'Programs List',
    subtitle: 'Strategy Workspace Overview',
    screenshot: '06-programs-list',
    stage: 3,
    description: `
      <p>The Programs List shows all EPM (Enterprise Program Management) programs created from strategic decisions.</p>
      <p>Each program displays:</p>
      <ul>
        <li><strong>Status</strong> — Draft, In Progress, or Finalized</li>
        <li><strong>Source</strong> — Which strategic journey generated it</li>
        <li><strong>Progress</strong> — Task completion metrics</li>
        <li><strong>Quick Actions</strong> — View, edit, or export</li>
      </ul>
    `
  },
  {
    id: 'epm-overview',
    title: 'EPM Dashboard - Overview',
    subtitle: 'Program Summary & Key Metrics',
    screenshot: '07-epm-overview',
    stage: 3,
    description: `
      <p>The EPM Dashboard provides a comprehensive 7-tab view of your program:</p>
      <div class="tabs-preview">
        <span class="tab-pill active">Overview</span>
        <span class="tab-pill">Tasks</span>
        <span class="tab-pill">Resources</span>
        <span class="tab-pill">Risks</span>
        <span class="tab-pill">Benefits</span>
        <span class="tab-pill">KPIs</span>
        <span class="tab-pill">Financials</span>
      </div>
      <p>The <strong>Overview tab</strong> presents program summary, status indicators, and key metrics at a glance.</p>
    `
  },
  {
    id: 'epm-tasks',
    title: 'EPM Dashboard - Tasks',
    subtitle: 'Work Breakdown Structure',
    screenshot: '08-epm-tasks',
    stage: 3,
    description: `
      <p>The <strong>Tasks tab</strong> shows the complete work breakdown structure:</p>
      <ul>
        <li>Hierarchical task organization</li>
        <li>Assignments and ownership</li>
        <li>Deadlines and dependencies</li>
        <li>Progress tracking</li>
        <li>Gantt chart visualization</li>
      </ul>
    `
  },
  {
    id: 'epm-resources',
    title: 'EPM Dashboard - Resources',
    subtitle: 'Team Capacity & Allocation',
    screenshot: '09-epm-resources',
    stage: 3,
    description: `
      <p>The <strong>Resources tab</strong> manages team capacity and allocation:</p>
      <ul>
        <li>Team member profiles and skills</li>
        <li>Capacity planning</li>
        <li>Workload distribution</li>
        <li>Over-allocation warnings</li>
      </ul>
    `
  },
  {
    id: 'epm-risks',
    title: 'EPM Dashboard - Risks',
    subtitle: 'Risk Register & Mitigation',
    screenshot: '10-epm-risks',
    stage: 3,
    description: `
      <p>The <strong>Risks tab</strong> provides comprehensive risk management:</p>
      <ul>
        <li>Risk identification and categorization</li>
        <li>Impact and probability assessment</li>
        <li>Mitigation strategies</li>
        <li>Status tracking and escalation</li>
      </ul>
    `
  }
];

function generateHTML() {
  console.log('🎨 Generating Premisia Walkthrough HTML...\n');
  
  const screenshotData = {};
  for (const section of sections) {
    const base64 = getScreenshot(section.screenshot);
    if (base64) {
      screenshotData[section.screenshot] = base64;
      console.log(`   ✓ Loaded ${section.screenshot}.png`);
    } else {
      console.log(`   ✗ Missing ${section.screenshot}.png`);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Premisia Platform Walkthrough - Complete Guide</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary: #1a1a2e;
            --secondary: #16213e;
            --accent: #e94560;
            --light: #f8f9fa;
            --text: #333;
            --text-muted: #666;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.7;
            color: var(--text);
            background: #fff;
        }
        
        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 50%, #0f3460 100%);
            color: white;
            padding: 80px 40px;
            text-align: center;
        }
        
        .hero h1 {
            font-size: 3.5rem;
            font-weight: 700;
            margin-bottom: 16px;
            letter-spacing: -1px;
        }
        
        .hero .tagline {
            font-size: 1.5rem;
            opacity: 0.9;
            font-style: italic;
            margin-bottom: 24px;
        }
        
        .hero .subtitle {
            font-size: 1.2rem;
            max-width: 700px;
            margin: 0 auto;
            opacity: 0.85;
        }
        
        /* Table of Contents */
        .toc {
            background: var(--light);
            padding: 40px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .toc h2 {
            text-align: center;
            color: var(--primary);
            margin-bottom: 24px;
        }
        
        .toc-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .toc-stage {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        
        .toc-stage h3 {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            color: var(--primary);
        }
        
        .stage-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
            color: white;
            border-radius: 50%;
            font-weight: bold;
            font-size: 14px;
        }
        
        .toc-stage ul {
            list-style: none;
            padding: 0;
        }
        
        .toc-stage li {
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .toc-stage li:last-child {
            border-bottom: none;
        }
        
        .toc-stage a {
            color: var(--text);
            text-decoration: none;
            transition: color 0.2s;
        }
        
        .toc-stage a:hover {
            color: var(--accent);
        }
        
        /* Main Content */
        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 0 40px;
        }
        
        /* Section Styles */
        .section {
            padding: 80px 0;
            border-bottom: 1px solid #e9ecef;
        }
        
        .section:nth-child(even) {
            background: var(--light);
        }
        
        .section-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
        }
        
        .section h2 {
            font-size: 2rem;
            color: var(--primary);
        }
        
        .section .subtitle {
            color: var(--text-muted);
            font-size: 1.1rem;
            margin-bottom: 24px;
        }
        
        .section-content {
            font-size: 1.05rem;
            margin-bottom: 32px;
        }
        
        .section-content ul {
            margin: 16px 0;
            padding-left: 24px;
        }
        
        .section-content li {
            margin: 8px 0;
        }
        
        /* Screenshot Container */
        .screenshot-container {
            background: #fff;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            margin: 32px 0;
        }
        
        .screenshot-label {
            font-size: 0.85rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .screenshot-label::before {
            content: "📷";
        }
        
        .screenshot-img {
            width: 100%;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            border: 1px solid #e9ecef;
        }
        
        .screenshot-missing {
            background: #f8d7da;
            color: #721c24;
            padding: 40px;
            border-radius: 12px;
            text-align: center;
        }
        
        /* Dimensions Grid */
        .dimensions-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin: 24px 0;
        }
        
        .dim-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            font-size: 0.9rem;
            font-weight: 500;
        }
        
        .dim-icon {
            display: block;
            font-size: 1.5rem;
            margin-bottom: 8px;
        }
        
        /* Tabs Preview */
        .tabs-preview {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin: 24px 0;
        }
        
        .tab-pill {
            background: #e9ecef;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            color: var(--text-muted);
        }
        
        .tab-pill.active {
            background: var(--primary);
            color: white;
        }
        
        /* Value Summary */
        .value-summary {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            padding: 80px 40px;
            text-align: center;
        }
        
        .value-summary h2 {
            color: white;
            margin-bottom: 40px;
        }
        
        .value-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            max-width: 900px;
            margin: 0 auto;
        }
        
        .value-card {
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 24px;
            text-align: left;
        }
        
        .value-card h4 {
            color: var(--accent);
            margin-bottom: 8px;
        }
        
        .value-card .without {
            opacity: 0.7;
            text-decoration: line-through;
            margin-bottom: 8px;
        }
        
        .value-card .with {
            font-weight: 600;
        }
        
        /* Footer */
        footer {
            background: var(--primary);
            color: rgba(255,255,255,0.6);
            text-align: center;
            padding: 32px;
        }
        
        footer strong {
            color: white;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .toc-grid { grid-template-columns: 1fr; }
            .dimensions-grid { grid-template-columns: repeat(2, 1fr); }
            .value-grid { grid-template-columns: 1fr; }
            .section { padding: 48px 0; }
            .container { padding: 0 20px; }
        }
    </style>
</head>
<body>
    <header class="hero">
        <h1>Premisia</h1>
        <p class="tagline">Think it through.</p>
        <p class="subtitle">Complete Platform Walkthrough with Real Data Examples</p>
    </header>

    <nav class="toc">
        <h2>Platform Overview</h2>
        <div class="toc-grid">
            <div class="toc-stage">
                <h3><span class="stage-badge">1</span> Marketing Consultant</h3>
                <ul>
                    <li><a href="#marketing-input">Input Page</a></li>
                    <li><a href="#segment-discovery">Segment Discovery Results</a></li>
                </ul>
            </div>
            <div class="toc-stage">
                <h3><span class="stage-badge">2</span> Strategic Consultant</h3>
                <ul>
                    <li><a href="#strategic-input">Input Page</a></li>
                    <li><a href="#journey-hub">Journey Hub</a></li>
                    <li><a href="#journey-results">Journey Results</a></li>
                </ul>
            </div>
            <div class="toc-stage">
                <h3><span class="stage-badge">3</span> Strategy Workspace</h3>
                <ul>
                    <li><a href="#programs-list">Programs List</a></li>
                    <li><a href="#epm-overview">EPM Overview</a></li>
                    <li><a href="#epm-tasks">EPM Tasks</a></li>
                    <li><a href="#epm-resources">EPM Resources</a></li>
                    <li><a href="#epm-risks">EPM Risks</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <main>
${sections.map(section => {
  const screenshotSrc = screenshotData[section.screenshot];
  const stageLabel = section.stage ? `<span class="stage-badge">${section.stage}</span>` : '';
  
  return `
        <section class="section" id="${section.id}">
            <div class="container">
                <div class="section-header">
                    ${stageLabel}
                    <h2>${section.title}</h2>
                </div>
                <p class="subtitle">${section.subtitle}</p>
                
                <div class="section-content">
                    ${section.description}
                </div>
                
                <div class="screenshot-container">
                    <div class="screenshot-label">${section.title}</div>
                    ${screenshotSrc 
                      ? `<img src="${screenshotSrc}" alt="${section.title}" class="screenshot-img" loading="lazy">`
                      : `<div class="screenshot-missing">Screenshot not available: ${section.screenshot}.png</div>`
                    }
                </div>
            </div>
        </section>`;
}).join('\n')}

        <section class="value-summary">
            <div class="container">
                <h2>The Premisia Difference</h2>
                <div class="value-grid">
                    <div class="value-card">
                        <h4>Market Targeting</h4>
                        <p class="without">Gut-feel guessing</p>
                        <p class="with">→ 100+ systematic segment evaluation</p>
                    </div>
                    <div class="value-card">
                        <h4>Strategic Analysis</h4>
                        <p class="without">Weeks of manual work</p>
                        <p class="with">→ Minutes of AI-enhanced analysis</p>
                    </div>
                    <div class="value-card">
                        <h4>Bias Detection</h4>
                        <p class="without">Confirmation bias unchecked</p>
                        <p class="with">→ Built-in contradiction detection</p>
                    </div>
                    <div class="value-card">
                        <h4>Execution</h4>
                        <p class="without">Strategy decks gather dust</p>
                        <p class="with">→ Executable EPM programs</p>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer>
        <p><strong>Premisia</strong> — From "I have this idea" to "here's exactly how we execute it."</p>
        <p style="margin-top: 8px;">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </footer>
</body>
</html>`;

  fs.writeFileSync(OUTPUT_FILE, html);
  console.log(`\n✅ HTML walkthrough generated: ${OUTPUT_FILE}`);
  
  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`   File size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generateHTML();
