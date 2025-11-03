// App.tsx - FULL EXCITING VERSION WITH ALL ANIMATIONS
import React, { useEffect, useState, useRef } from 'react';

interface Stats {
  frameworks: number;
  analysis: number;
  availability: number;
  clicks: number;
}

const App: React.FC = () => {
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [statsVisible, setStatsVisible] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({
    frameworks: 0,
    analysis: 0,
    availability: 0,
    clicks: 0
  });
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll handler
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);

    // Intersection observer for stats animation
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !statsVisible) {
            setStatsVisible(true);
            animateStats();
          }
        });
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    // Parallax effect for orbs
    const handleMouseMove = (e: MouseEvent) => {
      const orbs = document.querySelectorAll('.gradient-orb');
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      orbs.forEach((orb, index) => {
        const speed = (index + 1) * 10;
        (orb as HTMLElement).style.transform = `translate(${x * speed}px, ${y * speed}px)`;
      });
    };
    document.addEventListener('mousemove', handleMouseMove);

    // Color changing dots
    const colorInterval = setInterval(() => {
      const dots = document.querySelectorAll('.orbit-dot');
      dots.forEach((dot) => {
        (dot as HTMLElement).style.background = `hsl(${Math.random() * 60 + 180}, 70%, 50%)`;
      });
    }, 3000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousemove', handleMouseMove);
      clearInterval(colorInterval);
      if (statsRef.current) observer.unobserve(statsRef.current);
    };
  }, [statsVisible]);

  const animateStats = () => {
    const duration = 2000;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setStats({
        frameworks: Math.floor(5 * progress),
        analysis: Math.floor(100 * progress),
        availability: Math.floor(24 * progress),
        clicks: Math.floor(1 * progress)
      });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };

  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          overflow-x: hidden;
        }
        
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: float 20s infinite ease-in-out;
          transition: transform 0.3s ease;
        }
        
        .feature-card {
          opacity: 0;
          transform: translateY(30px);
          animation: fadeInUp 0.6s ease forwards;
        }
        
        .feature-card:nth-child(1) { animation-delay: 0.1s; }
        .feature-card:nth-child(2) { animation-delay: 0.2s; }
        .feature-card:nth-child(3) { animation-delay: 0.3s; }
        .feature-card:nth-child(4) { animation-delay: 0.4s; }
        .feature-card:nth-child(5) { animation-delay: 0.5s; }
        .feature-card:nth-child(6) { animation-delay: 0.6s; }
        
        .timeline-item {
          opacity: 0;
          transform: translateX(-50px);
          animation: slideIn 0.6s ease forwards;
        }
        
        .timeline-item:nth-child(1) { animation-delay: 0.1s; }
        .timeline-item:nth-child(2) { animation-delay: 0.2s; }
        .timeline-item:nth-child(3) { animation-delay: 0.3s; }
        .timeline-item:nth-child(4) { animation-delay: 0.4s; }
        .timeline-item:nth-child(5) { animation-delay: 0.5s; }
        
        .timeline-item:nth-child(even) {
          transform: translateX(50px);
        }
        
        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .orbit-dot {
          transition: background 0.3s ease;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#0f1419',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated Background */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          pointerEvents: 'none'
        }}>
          <div 
            className="gradient-orb"
            style={{
              width: '600px',
              height: '600px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              top: '-200px',
              right: '-200px'
            }}
          />
          <div 
            className="gradient-orb"
            style={{
              width: '500px',
              height: '500px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
              bottom: '-150px',
              left: '-150px',
              animationDelay: '5s'
            }}
          />
          <div 
            className="gradient-orb"
            style={{
              width: '400px',
              height: '400px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
              top: '50%',
              left: '50%',
              animationDelay: '10s'
            }}
          />
        </div>

        {/* Navigation */}
        <nav style={{
          position: 'fixed',
          top: 0,
          width: '100%',
          padding: scrolled ? '15px 50px' : '20px 50px',
          background: scrolled ? 'rgba(15, 20, 25, 0.95)' : 'rgba(15, 20, 25, 0.8)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>PREMISIA</div>
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none' }}>Features</a>
              <a href="#process" style={{ color: '#94a3b8', textDecoration: 'none' }}>How it Works</a>
              <a href="#use-cases" style={{ color: '#94a3b8', textDecoration: 'none' }}>Use Cases</a>
              <button style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>Login</button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          padding: '120px 50px 80px'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '60px',
            alignItems: 'center',
            width: '100%'
          }}>
            <div>
              <h1 style={{
                fontSize: '72px',
                fontWeight: 'bold',
                marginBottom: '20px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'fadeInUp 0.8s ease'
              }}>PREMISIA</h1>
              <div style={{
                fontSize: '32px',
                color: '#10b981',
                marginBottom: '30px',
                animation: 'fadeInUp 0.8s ease 0.2s both'
              }}>Think it through</div>
              <h2 style={{ fontSize: '36px', marginBottom: '20px' }}>
                Turn Your Wild Ideas into Real Strategies
              </h2>
              <p style={{
                fontSize: '18px',
                lineHeight: '1.6',
                color: '#94a3b8',
                marginBottom: '40px',
                animation: 'fadeInUp 0.8s ease 0.4s both'
              }}>
                Stop staring at blank whiteboards. Premisia uses AI to help you structure messy ideas 
                into clear strategic plans. From "I have this crazy idea" to "here's exactly how we do it" 
                in hours, not weeks.
              </p>
              <div style={{
                display: 'flex',
                gap: '20px',
                animation: 'fadeInUp 0.8s ease 0.6s both'
              }}>
                <button style={{
                  padding: '16px 32px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>🚀 Try It Now - It's Free</button>
                <button style={{
                  padding: '16px 32px',
                  background: 'transparent',
                  color: 'white',
                  border: '2px solid #3b82f6',
                  borderRadius: '10px',
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}>👀 See How It Works</button>
              </div>
            </div>
            
            {/* AI Brain Animation */}
            <div style={{
              width: '100%',
              height: '500px',
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <div style={{
                width: '200px',
                height: '200px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                borderRadius: '50%',
                boxShadow: '0 0 100px rgba(59, 130, 246, 0.5)',
                animation: 'breathe 3s infinite ease-in-out'
              }} />
              <div style={{
                position: 'absolute',
                width: '300px',
                height: '300px',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '50%',
                animation: 'rotate 15s linear infinite'
              }}>
                <div className="orbit-dot" style={{
                  position: 'absolute',
                  width: '10px',
                  height: '10px',
                  background: '#10b981',
                  borderRadius: '50%',
                  top: '-5px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  boxShadow: '0 0 20px #10b981'
                }} />
              </div>
              <div style={{
                position: 'absolute',
                width: '400px',
                height: '400px',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '50%',
                animation: 'rotate 20s linear infinite reverse'
              }}>
                <div className="orbit-dot" style={{
                  position: 'absolute',
                  width: '10px',
                  height: '10px',
                  background: '#10b981',
                  borderRadius: '50%',
                  top: '-5px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  boxShadow: '0 0 20px #10b981'
                }} />
              </div>
              <div style={{
                position: 'absolute',
                width: '500px',
                height: '500px',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '50%',
                animation: 'rotate 25s linear infinite'
              }}>
                <div className="orbit-dot" style={{
                  position: 'absolute',
                  width: '10px',
                  height: '10px',
                  background: '#10b981',
                  borderRadius: '50%',
                  top: '-5px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  boxShadow: '0 0 20px #10b981'
                }} />
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section with Animated Numbers */}
        <section ref={statsRef} style={{
          padding: '80px 50px',
          background: '#1a1f2e'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '40px'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#202938',
              borderRadius: '20px',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '10px'
              }}>{stats.frameworks}</div>
              <div style={{ fontSize: '18px', color: '#94a3b8' }}>Strategic Frameworks</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#202938',
              borderRadius: '20px',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '10px'
              }}>{stats.analysis}+</div>
              <div style={{ fontSize: '18px', color: '#94a3b8' }}>Analysis Points</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#202938',
              borderRadius: '20px',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '10px'
              }}>{stats.availability}/7</div>
              <div style={{ fontSize: '18px', color: '#94a3b8' }}>AI Available</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#202938',
              borderRadius: '20px',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '10px'
              }}>{stats.clicks} Click</div>
              <div style={{ fontSize: '18px', color: '#94a3b8' }}>To Get Started</div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" style={{ padding: '100px 50px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '48px',
                marginBottom: '20px',
                background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>Not Your Average Strategy Tool</h2>
              <p style={{ fontSize: '20px', color: '#94a3b8' }}>
                We built this because consultants are expensive and your napkin sketches deserve better
              </p>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '30px'
            }}>
              {[
                { icon: '🧠', badge: 'AI Magic', title: 'Multi-Agent AI Brain', desc: 'Three specialized AI agents work together: one challenges your assumptions, one builds your strategy, and one makes sure it actually makes sense.' },
                { icon: '🎯', title: 'Five Whys on Steroids', desc: 'Our AI doesn\'t just ask "why" five times. It digs deep, finds patterns you missed, and calls out the elephant in the room you\'ve been ignoring.' },
                { icon: '📊', title: 'Business Model Canvas++', desc: 'Fill out a BMC that actually thinks. It spots gaps, suggests connections, and tells you when your revenue model doesn\'t match your value prop.' },
                { icon: '🔍', title: 'Bias Detector', desc: 'We all drink our own Kool-Aid. Our AI is that friend who tells you your idea might not be as brilliant as you think (but helps you fix it).' },
                { icon: '📈', title: 'Instant Program Plans', desc: 'Go from strategy to execution roadmap in minutes. Complete with milestones, dependencies, and reality checks.' },
                { icon: '🔒', badge: 'Enterprise', title: 'Bank-Grade Security', desc: 'Zero-knowledge encryption means even we can\'t see your strategies. Your next unicorn idea is safer than Fort Knox.' }
              ].map((feature, idx) => (
                <div 
                  key={idx}
                  className="feature-card"
                  style={{
                    padding: '40px',
                    background: '#202938',
                    borderRadius: '20px',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  {feature.badge && (
                    <div style={{
                      position: 'absolute',
                      top: '20px',
                      right: '20px',
                      padding: '5px 10px',
                      background: '#8b5cf6',
                      color: 'white',
                      fontSize: '12px',
                      borderRadius: '20px',
                      fontWeight: '600'
                    }}>{feature.badge}</div>
                  )}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                    borderRadius: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                    fontSize: '28px'
                  }}>{feature.icon}</div>
                  <h3 style={{ fontSize: '24px', marginBottom: '15px' }}>{feature.title}</h3>
                  <p style={{ color: '#94a3b8', lineHeight: '1.6' }}>{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process Timeline */}
        <section id="process" style={{ padding: '100px 50px', background: '#1a1f2e' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '48px',
                marginBottom: '20px',
                background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>From Chaos to Clarity in 5 Steps</h2>
              <p style={{ fontSize: '20px', color: '#94a3b8' }}>
                How we turn your 3am shower thoughts into boardroom-ready strategies
              </p>
            </div>
            <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
              {[
                { title: '1. Brain Dump', desc: 'Type, talk, or upload your messy ideas. Half-baked is fine. Contradictory is expected. We\'ve seen worse.' },
                { title: '2. AI Interrogation', desc: 'Our AI asks the hard questions you\'ve been avoiding. It\'s like therapy for your business idea (but cheaper).' },
                { title: '3. Structure Emerges', desc: 'Watch as your random thoughts transform into organized frameworks. It\'s oddly satisfying.' },
                { title: '4. Reality Check', desc: 'Our bias detector and feasibility analyzer make sure you\'re not building castles in the sky.' },
                { title: '5. Action Plan', desc: 'Get your complete roadmap with tasks, timelines, and "watch out for this" warnings.' }
              ].map((step, idx) => (
                <div key={idx} className="timeline-item" style={{
                  display: 'flex',
                  marginBottom: '40px',
                  justifyContent: idx % 2 === 0 ? 'flex-start' : 'flex-end'
                }}>
                  <div style={{
                    padding: '30px',
                    background: '#202938',
                    borderRadius: '15px',
                    maxWidth: '400px'
                  }}>
                    <h3 style={{ fontSize: '24px', marginBottom: '15px', color: '#3b82f6' }}>{step.title}</h3>
                    <p style={{ color: '#94a3b8', lineHeight: '1.6' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security & Privacy Section */}
        <section id="security" style={{ padding: '100px 50px', background: '#0f1419' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <h2 style={{
                fontSize: '48px',
                marginBottom: '20px',
                background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>🔒 Your Ideas Are Sacred</h2>
              <p style={{ fontSize: '20px', color: '#94a3b8' }}>
                Bank-grade security because your next billion-dollar idea deserves Fort Knox protection
              </p>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '40px',
              marginBottom: '60px'
            }}>
              <div style={{
                padding: '40px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))',
                border: '2px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '20px'
              }}>
                <h3 style={{ fontSize: '28px', marginBottom: '20px', color: '#10b981' }}>
                  🛡️ Zero-Knowledge Architecture
                </h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '15px', color: '#94a3b8', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#10b981', marginRight: '10px' }}>✓</span>
                    <span>End-to-end encryption - we can't read your data even if we wanted to</span>
                  </li>
                  <li style={{ marginBottom: '15px', color: '#94a3b8', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#10b981', marginRight: '10px' }}>✓</span>
                    <span>Your strategic plans are encrypted before leaving your device</span>
                  </li>
                  <li style={{ marginBottom: '15px', color: '#94a3b8', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#10b981', marginRight: '10px' }}>✓</span>
                    <span>Only you have the keys - not even our AI can access without permission</span>
                  </li>
                  <li style={{ marginBottom: '15px', color: '#94a3b8', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#10b981', marginRight: '10px' }}>✓</span>
                    <span>Quantum-resistant encryption ready for the future</span>
                  </li>
                </ul>
              </div>
              <div style={{
                padding: '40px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '20px'
              }}>
                <h3 style={{ fontSize: '28px', marginBottom: '20px', color: '#8b5cf6' }}>
                  🔐 Enterprise-Grade Security
                </h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '15px', color: '#94a3b8', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#8b5cf6', marginRight: '10px' }}>✓</span>
                    <span>AWS KMS encryption with envelope protection</span>
                  </li>
                  <li style={{ marginBottom: '15px', color: '#94a3b8', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#8b5cf6', marginRight: '10px' }}>✓</span>
                    <span>AES-256 encryption for data at rest</span>
                  </li>
                  <li style={{ marginBottom: '15px', color: '#94a3b8', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#8b5cf6', marginRight: '10px' }}>✓</span>
                    <span>TLS 1.3 for all data in transit</span>
                  </li>
                  <li style={{ marginBottom: '15px', color: '#94a3b8', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ color: '#8b5cf6', marginRight: '10px' }}>✓</span>
                    <span>SOC 2 Type II compliance (in progress)</span>
                  </li>
                </ul>
              </div>
            </div>
            <div style={{
              background: '#1a1f2e',
              borderRadius: '20px',
              padding: '40px',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '32px', marginBottom: '20px', color: '#3b82f6' }}>
                Your Data, Your Control
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '30px',
                marginTop: '40px'
              }}>
                <div>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>🗑️</div>
                  <h4 style={{ fontSize: '18px', marginBottom: '10px' }}>Instant Deletion</h4>
                  <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                    Delete everything with one click. No questions, no retention.
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>📤</div>
                  <h4 style={{ fontSize: '18px', marginBottom: '10px' }}>Full Export</h4>
                  <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                    Export all your data anytime. It's yours, take it anywhere.
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>🚫</div>
                  <h4 style={{ fontSize: '18px', marginBottom: '10px' }}>No Training</h4>
                  <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                    Your data is never used to train AI models. Ever.
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>🏢</div>
                  <h4 style={{ fontSize: '18px', marginBottom: '10px' }}>Isolated Instances</h4>
                  <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                    Enterprise accounts get dedicated, isolated infrastructure.
                  </p>
                </div>
              </div>
            </div>
            <div style={{
              marginTop: '40px',
              padding: '20px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '10px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#f59e0b', fontSize: '16px' }}>
                <strong>🔍 Transparency Promise:</strong> We're building in public. Check our security practices, 
                audit logs, and compliance certificates anytime. Your trust is earned, not assumed.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section style={{
          padding: '100px 50px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <h2 style={{ fontSize: '48px', marginBottom: '20px' }}>
              Your Next Big Thing Starts Here
            </h2>
            <p style={{ fontSize: '20px', color: '#94a3b8', marginBottom: '40px' }}>
              Join thousands of founders, innovators, and strategic thinkers who've turned their ideas into action with Premisia.
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <button style={{
                padding: '16px 32px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>Start Building Your Strategy</button>
              <button style={{
                padding: '16px 32px',
                background: 'transparent',
                color: 'white',
                border: '2px solid #3b82f6',
                borderRadius: '10px',
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>Questions? Let's Chat</button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          padding: '60px 50px 30px',
          borderTop: '1px solid rgba(148, 163, 184, 0.1)',
          textAlign: 'center',
          color: '#94a3b8'
        }}>
          <p>&copy; 2025 Premisia - Where Ideas Become Action</p>
          <p style={{ marginTop: '10px', fontSize: '14px' }}>
            Built by strategists who got tired of expensive consultants and complicated frameworks.
          </p>
        </footer>
      </div>
    </>
  );
};

export default App;