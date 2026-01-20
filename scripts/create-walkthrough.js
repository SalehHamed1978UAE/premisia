import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = './docs/screenshots';

function imageToBase64(filepath) {
  try {
    const data = fs.readFileSync(filepath);
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch (e) {
    console.log(`Warning: Could not load ${filepath}`);
    return '';
  }
}

// Load unique screenshots
const screenshots = {
  landing: imageToBase64(path.join(SCREENSHOT_DIR, '00-landing.png')),
  journeyHub: imageToBase64(path.join(SCREENSHOT_DIR, '04-journey-hub.png')),
  strategicInput: imageToBase64(path.join(SCREENSHOT_DIR, '05-strategic-input.png')),
  journeyResults: imageToBase64(path.join(SCREENSHOT_DIR, '06-journey-results.png')),
  bmcResults: imageToBase64(path.join(SCREENSHOT_DIR, 'bmc_results_page.png')),
  fiveWhys: imageToBase64(path.join(SCREENSHOT_DIR, 'five-whys-level5.png')),
  journeyFramework: imageToBase64(path.join(SCREENSHOT_DIR, 'journeys_framework_sequence_full.png')),
  premisiaOG: imageToBase64(path.join(SCREENSHOT_DIR, 'premisia_og.png')),
};

const html = `<!DOCTYPE html>
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
            --success: #28a745;
            --light: #f8f9fa;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.7;
            color: #333;
            background: #fff;
        }
        .hero {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 50%, #0f3460 100%);
            color: white;
            padding: 100px 40px;
            text-align: center;
        }
        .hero h1 { font-size: 4rem; font-weight: 700; margin-bottom: 20px; letter-spacing: -2px; }
        .hero .tagline { font-size: 1.8rem; opacity: 0.9; font-style: italic; margin-bottom: 16px; }
        .hero .subtitle { font-size: 1.3rem; max-width: 800px; margin: 0 auto; opacity: 0.85; line-height: 1.6; }
        .container { max-width: 1100px; margin: 0 auto; padding: 0 40px; }
        section { padding: 80px 0; }
        section:nth-child(even) { background: var(--light); }
        h2 { font-size: 2.5rem; color: var(--primary); margin-bottom: 16px; }
        h3 { font-size: 1.6rem; color: var(--secondary); margin: 32px 0 16px; }
        p { margin-bottom: 16px; font-size: 1.1rem; color: #555; }
        .section-intro { font-size: 1.2rem; color: #666; margin-bottom: 40px; max-width: 800px; }
        .screenshot { 
            width: 100%; 
            border-radius: 12px; 
            box-shadow: 0 8px 40px rgba(0,0,0,0.15);
            margin: 24px 0;
            border: 1px solid #e0e0e0;
        }
        .feature-list { list-style: none; padding: 0; margin: 24px 0; }
        .feature-list li { 
            padding: 12px 0 12px 32px; 
            position: relative; 
            font-size: 1.1rem;
            border-bottom: 1px solid #eee;
        }
        .feature-list li::before { 
            content: "✓"; 
            position: absolute; 
            left: 0; 
            color: var(--success); 
            font-weight: bold;
            font-size: 1.2rem;
        }
        .stage-header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 24px;
        }
        .stage-number {
            width: 60px; height: 60px;
            background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            font-weight: bold;
            flex-shrink: 0;
        }
        .stage-title { font-size: 2.2rem; color: var(--primary); }
        .stage-question { color: var(--accent); font-weight: 600; font-size: 1.3rem; }
        .dimensions-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin: 32px 0;
        }
        .dimension-card {
            background: white;
            border-radius: 12px;
            padding: 24px 16px;
            text-align: center;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
            transition: transform 0.2s;
        }
        .dimension-card:hover { transform: translateY(-4px); }
        .dimension-card .icon { font-size: 2.5rem; margin-bottom: 12px; }
        .dimension-card h4 { font-size: 1rem; color: var(--primary); }
        .tabs-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin: 24px 0;
        }
        .tab-pill {
            background: #e8e8e8;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 0.95rem;
            color: #666;
        }
        .tab-pill.active { background: var(--primary); color: white; }
        .comparison-table { width: 100%; border-collapse: collapse; margin: 32px 0; }
        .comparison-table th, .comparison-table td { 
            padding: 18px 24px; 
            text-align: left; 
            border-bottom: 1px solid #eee; 
        }
        .comparison-table th { 
            background: var(--primary); 
            color: white; 
            font-size: 1.1rem;
        }
        .comparison-table th:first-child { border-radius: 12px 0 0 0; }
        .comparison-table th:last-child { border-radius: 0 12px 0 0; }
        .comparison-table .without { color: #dc3545; }
        .comparison-table .with { color: var(--success); font-weight: 500; }
        .flow-steps {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin: 40px 0;
            flex-wrap: wrap;
        }
        .flow-step {
            background: white;
            padding: 20px 28px;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
            text-align: center;
        }
        .flow-step strong { display: block; color: var(--primary); margin-bottom: 4px; }
        .flow-step span { font-size: 0.9rem; color: #666; }
        .flow-arrow { font-size: 2rem; color: var(--accent); }
        .cta-section {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            text-align: center;
            padding: 100px 40px;
        }
        .cta-section h2 { color: white; margin-bottom: 20px; }
        .cta-section p { color: rgba(255,255,255,0.9); font-size: 1.3rem; max-width: 600px; margin: 0 auto 16px; }
        footer { background: var(--primary); color: rgba(255,255,255,0.6); text-align: center; padding: 30px; }
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .dimensions-grid { grid-template-columns: repeat(2, 1fr); }
            .flow-steps { flex-direction: column; }
            .flow-arrow { transform: rotate(90deg); }
        }
    </style>
</head>
<body>
    <header class="hero">
        <h1>Premisia</h1>
        <p class="tagline">Think it through.</p>
        <p class="subtitle">The AI-enhanced platform that transforms strategic vision into executable programs. From identifying your ideal customers to building fully accountable project plans.</p>
    </header>

    <!-- Platform Overview -->
    <section>
        <div class="container">
            <h2>The Platform at a Glance</h2>
            <p class="section-intro">Premisia bridges the gap between strategic thinking and execution through three integrated stages. Each stage builds on the previous, creating a seamless journey from idea to implementation.</p>
            
            <img src="${screenshots.landing}" class="screenshot" alt="Premisia Landing Page">
            
            <div class="flow-steps">
                <div class="flow-step">
                    <strong>Stage 1</strong>
                    <span>Marketing Consultant</span>
                </div>
                <div class="flow-arrow">→</div>
                <div class="flow-step">
                    <strong>Stage 2</strong>
                    <span>Strategic Consultant</span>
                </div>
                <div class="flow-arrow">→</div>
                <div class="flow-step">
                    <strong>Stage 3</strong>
                    <span>Strategy Workspace</span>
                </div>
            </div>
        </div>
    </section>

    <!-- Stage 1: Marketing Consultant -->
    <section>
        <div class="container">
            <div class="stage-header">
                <div class="stage-number">1</div>
                <div>
                    <div class="stage-title">Marketing Consultant</div>
                    <div class="stage-question">WHO should you target?</div>
                </div>
            </div>
            
            <p class="section-intro">Systematically identify your ideal target customer segment using our proprietary "gene library" approach. Instead of gut-feel guessing, analyze 100+ customer segment candidates across 8 key dimensions.</p>
            
            <h3>The 8 Dimensions of Customer Segmentation</h3>
            <p>Every potential customer segment is evaluated across these 8 critical dimensions, creating a unique "genome" that reveals fit potential:</p>
            
            <div class="dimensions-grid">
                <div class="dimension-card"><div class="icon">🏭</div><h4>Industry</h4></div>
                <div class="dimension-card"><div class="icon">📊</div><h4>Company Size</h4></div>
                <div class="dimension-card"><div class="icon">🌍</div><h4>Geography</h4></div>
                <div class="dimension-card"><div class="icon">💻</div><h4>Technology Adoption</h4></div>
                <div class="dimension-card"><div class="icon">😰</div><h4>Pain Points</h4></div>
                <div class="dimension-card"><div class="icon">🛒</div><h4>Buying Behavior</h4></div>
                <div class="dimension-card"><div class="icon">⚔️</div><h4>Competition Exposure</h4></div>
                <div class="dimension-card"><div class="icon">📈</div><h4>Growth Potential</h4></div>
            </div>
            
            <h3>What You Get</h3>
            <ul class="feature-list">
                <li><strong>100+ Customer Segment Candidates</strong> - Systematically generated and scored for fit</li>
                <li><strong>Gene Library Analysis</strong> - Deep dive into each dimension with specific values</li>
                <li><strong>Beachhead Recommendation</strong> - AI-synthesized recommendation for which segment to target first</li>
                <li><strong>Validation Plan</strong> - Experiments to validate your beachhead choice before committing</li>
                <li><strong>Seamless Handoff</strong> - One-click transfer to Strategic Consultant with full context</li>
            </ul>
        </div>
    </section>

    <!-- Stage 2: Strategic Consultant -->
    <section>
        <div class="container">
            <div class="stage-header">
                <div class="stage-number">2</div>
                <div>
                    <div class="stage-title">Strategic Consultant</div>
                    <div class="stage-question">HOW should you compete?</div>
                </div>
            </div>
            
            <p class="section-intro">Deep strategic analysis using proven frameworks like Five Whys, Porter's Five Forces, and Business Model Canvas. With built-in anti-confirmation bias features that challenge your assumptions.</p>
            
            <h3>Journey Hub - Choose Your Framework</h3>
            <p>Select from multiple strategic analysis frameworks based on your needs:</p>
            
            <img src="${screenshots.journeyHub}" class="screenshot" alt="Journey Hub - Strategic Framework Selection">
            
            <h3>Strategic Input with Context</h3>
            <p>When coming from Marketing Consultant, your segment discovery insights are automatically carried forward:</p>
            
            <img src="${screenshots.strategicInput}" class="screenshot" alt="Strategic Consultant Input Page">
            
            <h3>Five Whys Root Cause Analysis</h3>
            <p>Interactive tree visualization that traces problems to their root causes through systematic "Why?" questioning:</p>
            
            <img src="${screenshots.fiveWhys}" class="screenshot" alt="Five Whys Tree - Root Cause Analysis">
            
            <h3>Business Model Canvas (9 Blocks)</h3>
            <p>Complete business model analysis covering all 9 blocks with AI-generated insights and cross-block consistency validation:</p>
            
            <img src="${screenshots.bmcResults}" class="screenshot" alt="Business Model Canvas Results - 9 Block Analysis">
            
            <h3>Journey Framework Sequence</h3>
            <p>Follow a structured sequence through your strategic analysis with clear progress tracking:</p>
            
            <img src="${screenshots.journeyFramework}" class="screenshot" alt="Journey Framework Sequence">
            
            <h3>Anti-Confirmation Bias Features</h3>
            <ul class="feature-list">
                <li><strong>Contradiction Detection</strong> - Automatically identifies conflicts between your assumptions and findings</li>
                <li><strong>Counter-Evidence Research</strong> - Surfaces alternative perspectives that challenge your conclusions</li>
                <li><strong>Assumption Flags</strong> - Highlights unvalidated assumptions for review</li>
                <li><strong>Confidence Indicators</strong> - Reliability scores for each insight</li>
            </ul>
            
            <h3>Journey Results</h3>
            <p>When your analysis is complete, review all findings and extract actionable strategic decisions:</p>
            
            <img src="${screenshots.journeyResults}" class="screenshot" alt="Journey Results - Completed Analysis">
        </div>
    </section>

    <!-- Stage 3: Strategy Workspace -->
    <section>
        <div class="container">
            <div class="stage-header">
                <div class="stage-number">3</div>
                <div>
                    <div class="stage-title">Strategy Workspace & EPM</div>
                    <div class="stage-question">Execute the plan with accountability</div>
                </div>
            </div>
            
            <p class="section-intro">Convert strategic decisions into executable Enterprise Program Management (EPM) programs. Full project management capabilities with tasks, resources, risks, KPIs, and financial tracking.</p>
            
            <h3>EPM Program Dashboard - 7 Tabs</h3>
            <p>Each generated program includes a comprehensive dashboard with seven specialized views:</p>
            
            <div class="tabs-row">
                <span class="tab-pill active">Overview</span>
                <span class="tab-pill">Tasks</span>
                <span class="tab-pill">Resources</span>
                <span class="tab-pill">Risks</span>
                <span class="tab-pill">Benefits</span>
                <span class="tab-pill">KPIs</span>
                <span class="tab-pill">Financials</span>
            </div>
            
            <table class="comparison-table">
                <thead>
                    <tr><th>Tab</th><th>What It Contains</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>Overview</strong></td><td>Program summary, status, key metrics, executive summary</td></tr>
                    <tr><td><strong>Tasks</strong></td><td>Work breakdown structure, assignments, dependencies, deadlines</td></tr>
                    <tr><td><strong>Resources</strong></td><td>Team members, capacity allocation, skill requirements</td></tr>
                    <tr><td><strong>Risks</strong></td><td>Risk register, probability/impact scoring, mitigation plans</td></tr>
                    <tr><td><strong>Benefits</strong></td><td>Expected outcomes, success metrics, benefit realization tracking</td></tr>
                    <tr><td><strong>KPIs</strong></td><td>Key performance indicators, targets, progress tracking</td></tr>
                    <tr><td><strong>Financials</strong></td><td>Budget breakdown, actuals, forecasts, variance analysis</td></tr>
                </tbody>
            </table>
            
            <h3>What You Get</h3>
            <ul class="feature-list">
                <li><strong>Automatic Program Generation</strong> - Strategic decisions are converted to structured programs</li>
                <li><strong>Full Work Breakdown</strong> - Tasks with owners, deadlines, and dependencies</li>
                <li><strong>Resource Planning</strong> - Team allocation and capacity management</li>
                <li><strong>Risk Management</strong> - Proactive identification and mitigation planning</li>
                <li><strong>Financial Tracking</strong> - Budget, actuals, and forecasting</li>
                <li><strong>Export Options</strong> - Full-pass ZIP bundles with all program data</li>
            </ul>
        </div>
    </section>

    <!-- Key Differentiators -->
    <section>
        <div class="container">
            <h2>The Premisia Difference</h2>
            
            <table class="comparison-table">
                <thead>
                    <tr><th>Without Premisia</th><th>With Premisia</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="without">Weeks of manual strategic analysis</td>
                        <td class="with">Minutes of AI-enhanced analysis</td>
                    </tr>
                    <tr>
                        <td class="without">Gut-feel market targeting</td>
                        <td class="with">Systematic 100+ segment evaluation</td>
                    </tr>
                    <tr>
                        <td class="without">Siloed frameworks in separate docs</td>
                        <td class="with">Integrated analysis with automatic handoffs</td>
                    </tr>
                    <tr>
                        <td class="without">Confirmation bias unchecked</td>
                        <td class="with">Built-in contradiction detection</td>
                    </tr>
                    <tr>
                        <td class="without">Strategy decks that gather dust</td>
                        <td class="with">Executable EPM programs with accountability</td>
                    </tr>
                    <tr>
                        <td class="without">Ideas without validation</td>
                        <td class="with">Beachhead + validation plan included</td>
                    </tr>
                    <tr>
                        <td class="without">Manual project setup</td>
                        <td class="with">Automatic program generation from decisions</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <!-- Enterprise Features -->
    <section>
        <div class="container">
            <h2>Enterprise-Grade Features</h2>
            
            <ul class="feature-list">
                <li><strong>AWS KMS Encryption</strong> - AES-256-GCM envelope encryption for all sensitive business data</li>
                <li><strong>Context Foundry Integration</strong> - Ground analysis in verified organizational facts</li>
                <li><strong>Document Intelligence</strong> - Extract insights from PDF, DOCX, Excel, and images</li>
                <li><strong>Background Job System</strong> - Non-blocking progress tracking with SSE streaming</li>
                <li><strong>Version Management</strong> - Track how your strategy evolves over time</li>
                <li><strong>Multi-Provider AI</strong> - Fallback across OpenAI, Anthropic, and Gemini</li>
                <li><strong>Role-Based Access</strong> - Admin, Editor, Viewer permission levels</li>
            </ul>
        </div>
    </section>

    <!-- CTA -->
    <section class="cta-section">
        <h2>Ready to Think It Through?</h2>
        <p>Transform your strategic vision into executable programs in minutes, not months.</p>
        <p style="font-size: 1rem; opacity: 0.7; margin-top: 24px;">Beta access limited to 50 users globally</p>
    </section>

    <footer>
        <p>Premisia &copy; 2025 - AI-Enhanced Enterprise Program Management</p>
        <p style="margin-top: 8px; font-size: 0.9rem;">From "I have this idea" to "Here's exactly how we execute it"</p>
    </footer>
</body>
</html>`;

fs.writeFileSync('./docs/premisia-walkthrough.html', html);
console.log('Generated comprehensive walkthrough at docs/premisia-walkthrough.html');
console.log('File size:', (fs.statSync('./docs/premisia-walkthrough.html').size / 1024).toFixed(1), 'KB');
