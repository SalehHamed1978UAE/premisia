// LandingPage.jsx - Save this as LandingPage.jsx in your React app
import React, { useEffect, useState, useRef } from 'react';
import './LandingPage.css'; // We'll create this CSS file next

const LandingPage = () => {
  const [scrolled, setScrolled] = useState(false);
  const [statsAnimated, setStatsAnimated] = useState(false);
  const statsRef = useRef(null);
  const [stats, setStats] = useState({
    frameworks: 0,
    analysis: 0,
    availability: 0,
    clicks: 0
  });

  useEffect(() => {
    // Navbar scroll effect
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);

    // Stats animation observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !statsAnimated) {
            setStatsAnimated(true);
            animateStats();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    // Parallax effect for orbs
    const handleMouseMove = (e) => {
      const orbs = document.querySelectorAll('.gradient-orb');
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      orbs.forEach((orb, index) => {
        const speed = (index + 1) * 10;
        orb.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
      });
    };
    document.addEventListener('mousemove', handleMouseMove);

    // Color changing dots
    const colorInterval = setInterval(() => {
      const dots = document.querySelectorAll('.orbit-dot');
      dots.forEach(dot => {
        dot.style.background = `hsl(${Math.random() * 60 + 180}, 70%, 50%)`;
      });
    }, 3000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousemove', handleMouseMove);
      clearInterval(colorInterval);
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, [statsAnimated]);

  const animateStats = () => {
    const duration = 2000;
    const targets = { frameworks: 5, analysis: 100, availability: 24, clicks: 1 };
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setStats({
        frameworks: Math.floor(targets.frameworks * progress),
        analysis: Math.floor(targets.analysis * progress),
        availability: Math.floor(targets.availability * progress),
        clicks: Math.floor(targets.clicks * progress)
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">
      {/* Animated Background */}
      <div className="animated-bg">
        <div className="gradient-orb orb1"></div>
        <div className="gradient-orb orb2"></div>
        <div className="gradient-orb orb3"></div>
      </div>

      {/* Navigation */}
      <nav className={scrolled ? 'navbar scrolled' : 'navbar'}>
        <div className="nav-container">
          <div className="logo-text">PREMISIA</div>
          <div className="nav-links">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>
              Features
            </a>
            <a href="#process" onClick={(e) => { e.preventDefault(); scrollToSection('process'); }}>
              How it Works
            </a>
            <a href="#use-cases" onClick={(e) => { e.preventDefault(); scrollToSection('use-cases'); }}>
              Use Cases
            </a>
            <button className="cta-button" onClick={() => window.location.href='/login'}>
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">PREMISIA</h1>
            <div className="hero-subtitle">Think it through</div>
            <h2>Turn Your Wild Ideas into Real Strategies</h2>
            <p className="hero-description">
              Stop staring at blank whiteboards. Premisia uses AI to help you structure messy ideas 
              into clear strategic plans. From "I have this crazy idea" to "here's exactly how we do it" 
              in hours, not weeks.
            </p>
            <div className="hero-buttons">
              <button className="btn-primary" onClick={() => window.location.href='/login'}>
                🚀 Try It Now - It's Free
              </button>
              <button className="btn-secondary" onClick={() => scrollToSection('features')}>
                👀 See How It Works
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="ai-brain">
              <div className="orbit orbit1">
                <div className="orbit-dot"></div>
              </div>
              <div className="orbit orbit2">
                <div className="orbit-dot"></div>
              </div>
              <div className="orbit orbit3">
                <div className="orbit-dot"></div>
              </div>
              <div className="brain-core"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats" ref={statsRef}>
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-number">{stats.frameworks}</div>
            <div className="stat-label">Strategic Frameworks</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.analysis}+</div>
            <div className="stat-label">Analysis Points</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.availability}/7</div>
            <div className="stat-label">AI Available</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.clicks} Click</div>
            <div className="stat-label">To Get Started</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="features-container">
          <div className="section-header">
            <h2>Not Your Average Strategy Tool</h2>
            <p>We built this because consultants are expensive and your napkin sketches deserve better</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-badge">AI Magic</div>
              <div className="feature-icon">🧠</div>
              <h3>Multi-Agent AI Brain</h3>
              <p>Three specialized AI agents work together: one challenges your assumptions, one builds your strategy, and one makes sure it actually makes sense.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Five Whys on Steroids</h3>
              <p>Our AI doesn't just ask "why" five times. It digs deep, finds patterns you missed, and calls out the elephant in the room you've been ignoring.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Business Model Canvas++</h3>
              <p>Fill out a BMC that actually thinks. It spots gaps, suggests connections, and tells you when your revenue model doesn't match your value prop.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Bias Detector</h3>
              <p>We all drink our own Kool-Aid. Our AI is that friend who tells you your idea might not be as brilliant as you think (but helps you fix it).</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Instant Program Plans</h3>
              <p>Go from strategy to execution roadmap in minutes. Complete with milestones, dependencies, and reality checks.</p>
            </div>
            <div className="feature-card">
              <div className="feature-badge">Beta</div>
              <div className="feature-icon">🔮</div>
              <h3>What-If Simulator</h3>
              <p>Test different scenarios. What if you pivot? What if funding takes longer? What if your competitor moves first? See it all play out.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="process" id="process">
        <div className="features-container">
          <div className="section-header">
            <h2>From Chaos to Clarity in 5 Steps</h2>
            <p>How we turn your 3am shower thoughts into boardroom-ready strategies</p>
          </div>
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-content">
                <h3>1. Brain Dump</h3>
                <p>Type, talk, or upload your messy ideas. Half-baked is fine. Contradictory is expected.</p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-content">
                <h3>2. AI Interrogation</h3>
                <p>Our AI asks the hard questions you've been avoiding. It's like therapy for your business idea.</p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-content">
                <h3>3. Structure Emerges</h3>
                <p>Watch as your random thoughts transform into organized frameworks. It's oddly satisfying.</p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-content">
                <h3>4. Reality Check</h3>
                <p>Our bias detector and feasibility analyzer make sure you're not building castles in the sky.</p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-content">
                <h3>5. Action Plan</h3>
                <p>Get your complete roadmap with tasks, timelines, and "watch out for this" warnings.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases" id="use-cases">
        <div className="features-container">
          <div className="section-header">
            <h2>Who's Using Premisia?</h2>
            <p>Real people solving real problems</p>
          </div>
          <div className="use-cases-grid">
            <div className="use-case-card">
              <h3>🚀 The Midnight Entrepreneur</h3>
              <p>"I had this idea for a sustainable coffee subscription at 2am. By morning, I had a full business model, competitive analysis, and a 90-day launch plan."</p>
              <cite>- Sarah, Coffee Startup Founder</cite>
            </div>
            <div className="use-case-card">
              <h3>💼 The Frustrated Manager</h3>
              <p>"Our digital transformation was going nowhere. Premisia helped me structure the chaos and present a plan that actually got approved."</p>
              <cite>- Marcus, Tech Team Lead</cite>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Your Next Big Thing Starts Here</h2>
          <p>Join thousands of founders, innovators, and strategic thinkers who've turned ideas into action.</p>
          <div className="cta-buttons">
            <button className="btn-primary" onClick={() => window.location.href='/login'}>
              Start Building Your Strategy
            </button>
            <button className="btn-secondary" onClick={() => window.location.href='mailto:hello@premisia.ai'}>
              Questions? Let's Chat
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <p>&copy; 2025 Premisia - Where Ideas Become Action</p>
        <p>Built by strategists who got tired of expensive consultants and complicated frameworks.</p>
      </footer>
    </div>
  );
};

export default LandingPage;