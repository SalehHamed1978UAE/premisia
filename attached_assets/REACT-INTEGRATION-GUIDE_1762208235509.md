# REACT INTEGRATION GUIDE FOR PREMISIA

## 🚀 Quick Setup for Replit React App

### Step 1: Add the Component Files
1. **[LandingPage.jsx](LandingPage.jsx)** - Copy this to your `src` folder
2. **[LandingPage.css](LandingPage.css)** - Copy this to your `src` folder (same location as jsx)

### Step 2: Update Your App.js

Replace your `App.js` (or `App.jsx`) with this:

```jsx
import React from 'react';
import LandingPage from './LandingPage';
import './App.css';

function App() {
  return (
    <div className="App">
      <LandingPage />
    </div>
  );
}

export default App;
```

### Step 3: Clear App.css
Remove everything from `App.css` and add only this:

```css
.App {
  width: 100%;
  min-height: 100vh;
}
```

---

## 🔧 Alternative: All-in-One App.js

If you prefer everything in one file, use this:

```jsx
// App.js - Replace your entire App.js with this
import React, { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  const [scrolled, setScrolled] = useState(false);
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

    // Animate stats on mount
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

    // Start animations after 1 second
    setTimeout(animateStats, 1000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="App">
      {/* Your landing page content here - simplified version */}
      <div style={{
        minHeight: '100vh',
        background: '#0f1419',
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}>
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
            <button style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>Login</button>
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
            textAlign: 'center'
          }}>
            <h1 style={{
              fontSize: '72px',
              fontWeight: 'bold',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>PREMISIA</h1>
            <p style={{
              fontSize: '32px',
              color: '#10b981',
              marginBottom: '30px'
            }}>Think it through</p>
            <p style={{
              fontSize: '18px',
              lineHeight: '1.6',
              color: '#94a3b8',
              marginBottom: '40px',
              maxWidth: '800px',
              margin: '0 auto 40px'
            }}>
              Stop staring at blank whiteboards. Premisia uses AI to help you structure messy ideas 
              into clear strategic plans. From crazy idea to execution plan in hours.
            </p>
            <button style={{
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              marginRight: '20px'
            }}>🚀 Try It Free</button>
            <button style={{
              padding: '16px 32px',
              background: 'transparent',
              color: 'white',
              border: '2px solid #3b82f6',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>Learn More</button>
          </div>
        </section>

        {/* Stats Section */}
        <section style={{
          padding: '80px 50px',
          background: '#1a1f2e'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '40px'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#202938',
              borderRadius: '20px'
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#3b82f6',
                marginBottom: '10px'
              }}>{stats.frameworks}</div>
              <div style={{ color: '#94a3b8' }}>Strategic Frameworks</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#202938',
              borderRadius: '20px'
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#10b981',
                marginBottom: '10px'
              }}>{stats.analysis}+</div>
              <div style={{ color: '#94a3b8' }}>Analysis Points</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#202938',
              borderRadius: '20px'
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#8b5cf6',
                marginBottom: '10px'
              }}>{stats.availability}/7</div>
              <div style={{ color: '#94a3b8' }}>AI Available</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: '#202938',
              borderRadius: '20px'
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#f59e0b',
                marginBottom: '10px'
              }}>{stats.clicks}</div>
              <div style={{ color: '#94a3b8' }}>Click to Start</div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          padding: '60px',
          textAlign: 'center',
          color: '#94a3b8',
          borderTop: '1px solid #202938'
        }}>
          <p>&copy; 2025 Premisia - Where Ideas Become Action</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
```

---

## 🐛 Troubleshooting React Issues

### Common Problems & Fixes:

1. **"Module not found" Error**
   - Make sure `LandingPage.jsx` and `LandingPage.css` are in the `src` folder
   - Check the import path: `import LandingPage from './LandingPage';`

2. **Styles not applying**
   - Make sure the CSS file is imported: `import './LandingPage.css';`
   - Clear browser cache: Ctrl+Shift+R
   - In Replit, try stopping and restarting the app

3. **Animations not working**
   - Check browser console for errors (F12)
   - Make sure React version is 16.8+ (for hooks)
   - Try adding this to package.json dependencies:
   ```json
   "react": "^18.0.0",
   "react-dom": "^18.0.0"
   ```

4. **Blank page**
   - Check if index.js has: `root.render(<App />);`
   - Verify public/index.html has: `<div id="root"></div>`

---

## 📦 Required Dependencies

Make sure your `package.json` includes:

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-scripts": "5.0.1"
  }
}
```

Run `npm install` after updating package.json

---

## ✅ Testing Your Setup

1. The page should have a dark background (#0f1419)
2. "PREMISIA" logo should have a blue-green gradient
3. Numbers should animate from 0 to their targets
4. Navigation bar should shrink when scrolling
5. All buttons should be clickable

---

## 🚀 Replit-Specific Setup

1. In Replit, make sure you're using the "React" template
2. File structure should be:
```
my-replit-project/
├── src/
│   ├── App.js
│   ├── App.css
│   ├── LandingPage.jsx    <-- Add this
│   ├── LandingPage.css    <-- Add this
│   └── index.js
├── public/
│   └── index.html
└── package.json
```

3. After adding files, click "Stop" then "Run" in Replit

---

## 💡 Still having issues?

Try the simplified inline version in App.js above - it has fewer dependencies and should work in any React setup!