import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = './docs/screenshots';

function imageToBase64(filepath) {
  const data = fs.readFileSync(filepath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

const screenshots = {
  landing: imageToBase64(path.join(SCREENSHOT_DIR, '01-landing.png')),
  marketingInput: imageToBase64(path.join(SCREENSHOT_DIR, '02-marketing-input.png')),
  journeyHub: imageToBase64(path.join(SCREENSHOT_DIR, '03-journey-hub.png')),
  strategicInput: imageToBase64(path.join(SCREENSHOT_DIR, '04-strategic-input.png')),
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Premisia - AI-Enhanced Enterprise Program Management</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a2e;
            background: #ffffff;
        }
        .hero {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: white;
            padding: 80px 40px;
            text-align: center;
        }
        .hero h1 { font-size: 3.5rem; font-weight: 700; margin-bottom: 16px; }
        .hero .tagline { font-size: 1.5rem; opacity: 0.9; margin-bottom: 24px; font-style: italic; }
        .hero .subtitle { font-size: 1.2rem; max-width: 700px; margin: 0 auto; opacity: 0.85; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 40px; }
        section { padding: 60px 0; }
        h2 { font-size: 2.2rem; color: #1a1a2e; margin-bottom: 32px; text-align: center; }
        h3 { font-size: 1.5rem; color: #16213e; margin-bottom: 16px; }
        .value-prop { background: #f8f9fa; }
        .three-stages { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; }
        .stage-card {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .stage-number {
            display: inline-block;
            width: 40px; height: 40px;
            background: linear-gradient(135deg, #e94560 0%, #0f3460 100%);
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 40px;
            font-weight: bold;
            margin-bottom: 16px;
        }
        .stage-card .question { color: #e94560; font-weight: 600; margin-bottom: 12px; }
        .stage-card ul { list-style: none; padding: 0; }
        .stage-card li { padding: 8px 0; padding-left: 24px; position: relative; }
        .stage-card li::before { content: "✓"; position: absolute; left: 0; color: #28a745; font-weight: bold; }
        .screenshot-section { margin: 48px 0; }
        .screenshot-container {
            background: #f8f9fa;
            border-radius: 16px;
            padding: 24px;
            margin: 24px 0;
        }
        .screenshot-label {
            font-size: 0.9rem;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 16px;
        }
        .screenshot-img {
            width: 100%;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .feature-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; margin-top: 40px; }
        .feature-card {
            display: flex;
            gap: 16px;
            padding: 24px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .feature-icon {
            width: 48px; height: 48px;
            background: linear-gradient(135deg, #e94560 0%, #0f3460 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            flex-shrink: 0;
        }
        .feature-content h4 { color: #1a1a2e; margin-bottom: 8px; }
        .feature-content p { color: #666; font-size: 0.95rem; }
        .comparison-table { width: 100%; border-collapse: collapse; margin-top: 32px; }
        .comparison-table th, .comparison-table td { padding: 16px 24px; text-align: left; border-bottom: 1px solid #eee; }
        .comparison-table th { background: #1a1a2e; color: white; }
        .comparison-table th:first-child { border-radius: 12px 0 0 0; }
        .comparison-table th:last-child { border-radius: 0 12px 0 0; }
        .comparison-table tr:nth-child(even) { background: #f8f9fa; }
        .comparison-table .without { color: #dc3545; }
        .comparison-table .with { color: #28a745; font-weight: 500; }
        .flow-section { background: #f8f9fa; }
        .flow-diagram { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 40px 0; flex-wrap: wrap; }
        .flow-step { background: white; padding: 20px 32px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); text-align: center; }
        .flow-step .step-title { font-weight: 600; color: #1a1a2e; }
        .flow-step .step-desc { font-size: 0.85rem; color: #666; margin-top: 4px; }
        .flow-arrow { font-size: 2rem; color: #e94560; }
        .dimensions-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 32px 0; }
        .dimension-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        .dimension-card .icon { font-size: 2rem; margin-bottom: 8px; }
        .dimension-card h4 { font-size: 0.9rem; color: #1a1a2e; }
        .tabs-preview { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .tab-pill { background: #e8e8e8; padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; color: #666; }
        .tab-pill.active { background: #1a1a2e; color: white; }
        .cta-section { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; text-align: center; padding: 80px 40px; }
        .cta-section h2 { color: white; }
        .cta-section p { font-size: 1.2rem; opacity: 0.9; max-width: 600px; margin: 0 auto 32px; }
        footer { background: #1a1a2e; color: rgba(255,255,255,0.6); text-align: center; padding: 24px; }
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .three-stages { grid-template-columns: 1fr; }
            .feature-grid { grid-template-columns: 1fr; }
            .dimensions-grid { grid-template-columns: repeat(2, 1fr); }
            .flow-diagram { flex-direction: column; }
            .flow-arrow { transform: rotate(90deg); }
        }
    </style>
</head>
<body>
    <header class="hero">
        <h1>Premisia</h1>
        <p class="tagline">Think it through.</p>
        <p class="subtitle">AI-Enhanced Enterprise Program Management that transforms strategic vision into executable programs</p>
    </header>

    <section>
        <div class="container">
            <h2>The Platform at a Glance</h2>
            <div class="screenshot-section">
                <div class="screenshot-container">
                    <div class="screenshot-label">Landing Page</div>
                    <img src="${screenshots.landing}" class="screenshot-img" alt="Premisia Landing Page">
                </div>
            </div>
        </div>
    </section>

    <section class="value-prop">
        <div class="container">
            <h2>From "I have this idea" to "Here's exactly how we execute it"</h2>
            
            <div class="three-stages">
                <div class="stage-card">
                    <div class="stage-number">1</div>
                    <h3>Marketing Consultant</h3>
                    <p class="question">WHO to target?</p>
                    <ul>
                        <li>100+ customer segment candidates</li>
                        <li>8-dimension gene library analysis</li>
                        <li>AI-synthesized beachhead recommendation</li>
                        <li>Validation plan included</li>
                    </ul>
                </div>
                
                <div class="stage-card">
                    <div class="stage-number">2</div>
                    <h3>Strategic Consultant</h3>
                    <p class="question">HOW to compete?</p>
                    <ul>
                        <li>Five Whys root cause analysis</li>
                        <li>Porter's Five Forces</li>
                        <li>Business Model Canvas (9 blocks)</li>
                        <li>Built-in contradiction detection</li>
                    </ul>
                </div>
                
                <div class="stage-card">
                    <div class="stage-number">3</div>
                    <h3>Strategy Workspace</h3>
                    <p class="question">Execute the plan</p>
                    <ul>
                        <li>EPM program generation</li>
                        <li>7-tab project dashboard</li>
                        <li>Tasks, resources, risks, KPIs</li>
                        <li>Built-in accountability</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>

    <section>
        <div class="container">
            <h2>Stage 1: Marketing Consultant</h2>
            <p style="text-align: center; color: #666; margin-bottom: 32px;">Systematically identify your ideal target customer segment using a "gene library" approach</p>
            
            <div class="screenshot-section">
                <div class="screenshot-container">
                    <div class="screenshot-label">Marketing Consultant Input</div>
                    <img src="${screenshots.marketingInput}" class="screenshot-img" alt="Marketing Consultant Input Page">
                </div>
            </div>
            
            <h3 style="text-align: center; margin-top: 48px;">The 8 Dimensions of Customer Segmentation</h3>
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
        </div>
    </section>

    <section class="flow-section">
        <div class="container">
            <h2>Stage 2: Strategic Consultant</h2>
            <p style="text-align: center; color: #666; margin-bottom: 32px;">Deep strategic analysis with proven frameworks and built-in bias detection</p>
            
            <div class="flow-diagram">
                <div class="flow-step"><div class="step-title">Input Challenge</div><div class="step-desc">Describe your strategic challenge</div></div>
                <div class="flow-arrow">→</div>
                <div class="flow-step"><div class="step-title">Select Journey</div><div class="step-desc">Five Whys, Porter's, BMC, etc.</div></div>
                <div class="flow-arrow">→</div>
                <div class="flow-step"><div class="step-title">AI Analysis</div><div class="step-desc">Grounded research & insights</div></div>
                <div class="flow-arrow">→</div>
                <div class="flow-step"><div class="step-title">Extract Decisions</div><div class="step-desc">Actionable strategic decisions</div></div>
            </div>
            
            <div class="screenshot-section">
                <div class="screenshot-container">
                    <div class="screenshot-label">Journey Hub - Available Strategic Journeys</div>
                    <img src="${screenshots.journeyHub}" class="screenshot-img" alt="Journey Hub">
                </div>
            </div>
            
            <div class="screenshot-section">
                <div class="screenshot-container">
                    <div class="screenshot-label">Strategic Consultant Input</div>
                    <img src="${screenshots.strategicInput}" class="screenshot-img" alt="Strategic Consultant Input">
                </div>
            </div>
        </div>
    </section>

    <section>
        <div class="container">
            <h2>Stage 3: Strategy Workspace & EPM</h2>
            <p style="text-align: center; color: #666; margin-bottom: 32px;">Convert strategic decisions into executable programs with full accountability</p>
            
            <h3 style="text-align: center; margin-top: 32px;">EPM Program Dashboard - 7 Tabs</h3>
            <div class="tabs-preview">
                <span class="tab-pill active">Overview</span>
                <span class="tab-pill">Tasks</span>
                <span class="tab-pill">Resources</span>
                <span class="tab-pill">Risks</span>
                <span class="tab-pill">Benefits</span>
                <span class="tab-pill">KPIs</span>
                <span class="tab-pill">Financials</span>
            </div>
        </div>
    </section>

    <section class="value-prop">
        <div class="container">
            <h2>Key Differentiators</h2>
            
            <div class="feature-grid">
                <div class="feature-card">
                    <div class="feature-icon">🎯</div>
                    <div class="feature-content">
                        <h4>Systematic Coverage</h4>
                        <p>100+ customer segment candidates evaluated systematically, not gut-feel guessing</p>
                    </div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔍</div>
                    <div class="feature-content">
                        <h4>Contradiction Detection</h4>
                        <p>Built-in anti-confirmation bias research challenges your assumptions</p>
                    </div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔗</div>
                    <div class="feature-content">
                        <h4>End-to-End Pipeline</h4>
                        <p>Seamless handoff from segment discovery to strategic analysis to execution</p>
                    </div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📋</div>
                    <div class="feature-content">
                        <h4>Executable Programs</h4>
                        <p>Strategy becomes real programs with tasks, timelines, and accountability</p>
                    </div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔐</div>
                    <div class="feature-content">
                        <h4>Enterprise Security</h4>
                        <p>AWS KMS envelope encryption protects your sensitive business data</p>
                    </div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🌐</div>
                    <div class="feature-content">
                        <h4>Grounded Analysis</h4>
                        <p>Context Foundry integration ensures insights are based on verified organizational facts</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section>
        <div class="container">
            <h2>The Premisia Difference</h2>
            
            <table class="comparison-table">
                <thead>
                    <tr><th>Without Premisia</th><th>With Premisia</th></tr>
                </thead>
                <tbody>
                    <tr><td class="without">Weeks of manual strategic analysis</td><td class="with">Minutes of AI-enhanced analysis</td></tr>
                    <tr><td class="without">Gut-feel market targeting</td><td class="with">Systematic 100+ segment evaluation</td></tr>
                    <tr><td class="without">Siloed frameworks in separate docs</td><td class="with">Integrated analysis with automatic handoffs</td></tr>
                    <tr><td class="without">Confirmation bias unchecked</td><td class="with">Built-in contradiction detection</td></tr>
                    <tr><td class="without">Strategy decks gather dust</td><td class="with">Executable EPM programs with accountability</td></tr>
                    <tr><td class="without">Ideas without validation</td><td class="with">Beachhead + validation plan included</td></tr>
                </tbody>
            </table>
        </div>
    </section>

    <section class="cta-section">
        <h2>Ready to Think It Through?</h2>
        <p>Transform your strategic vision into executable programs in minutes, not months.</p>
        <p style="font-size: 1rem; opacity: 0.7;">Beta access limited to 50 users globally</p>
    </section>

    <footer>
        <p>Premisia © 2025 - AI-Enhanced Enterprise Program Management</p>
    </footer>
</body>
</html>`;

fs.writeFileSync('./docs/premisia-brochure-final.html', html);
console.log('Generated docs/premisia-brochure-final.html with embedded screenshots!');
