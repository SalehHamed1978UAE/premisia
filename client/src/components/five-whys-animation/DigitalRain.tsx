import { useEffect, useRef } from 'react';

interface DigitalRainProps {
  intensity?: number; // 0-100, affects number of columns
  isPaused?: boolean;
}

const CHARACTERS = '0123456789ABCDEFｱｲｳｴｵWHY?ROOTCAUSEIMPLICATIONS';
const CYAN_BRIGHT = '#00d9ff';
const CYAN_DIM = '#0088aa';
const BG_COLOR = '#0a0e1a';

export function DigitalRain({ intensity = 50, isPaused = false }: DigitalRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Simple static gradient instead
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = CYAN_DIM;
      ctx.font = '14px monospace';
      ctx.fillText('Loading...', canvas.width / 2 - 40, canvas.height / 2);
      return;
    }

    // Set canvas size
    const setCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    setCanvasSize();

    // Column configuration - Many more columns for dense Matrix effect
    const fontSize = 16;
    const columnWidth = fontSize;
    const numColumns = Math.floor(canvas.width / columnWidth / (window.devicePixelRatio || 1));
    const baseColumns = Math.floor(numColumns * 0.7); // Minimum 70% of columns active
    const intensityColumns = Math.floor(numColumns * 0.3 * (intensity / 100)); // Up to 30% more based on intensity
    const activeColumns = Math.min(baseColumns + intensityColumns, numColumns); // Max out at numColumns

    interface Column {
      x: number;
      y: number;
      speed: number;
      chars: string[];
      length: number;
    }

    const columns: Column[] = [];

    // Initialize columns
    for (let i = 0; i < activeColumns; i++) {
      columns.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        speed: 1 + Math.random() * 3, // Variable speed
        chars: [],
        length: 10 + Math.floor(Math.random() * 20),
      });
    }

    // Generate random character
    const getRandomChar = () => {
      return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    };

    // Animation loop
    const animate = () => {
      if (isPaused) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Check if tab is visible
      if (document.visibilityState === 'hidden') {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Fade effect for trail
      ctx.fillStyle = 'rgba(10, 14, 26, 0.05)';
      ctx.fillRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));

      ctx.font = `${fontSize}px monospace`;

      columns.forEach((column) => {
        // Update column
        column.y += column.speed;

        // Reset column when it goes off screen
        if (column.y > canvas.height / (window.devicePixelRatio || 1) + column.length * fontSize) {
          column.y = -column.length * fontSize;
          column.x = Math.random() * canvas.width / (window.devicePixelRatio || 1);
          column.chars = [];
        }

        // Draw column characters
        for (let i = 0; i < column.length; i++) {
          const charY = column.y - i * fontSize;
          
          // Skip if off screen
          if (charY < -fontSize || charY > canvas.height / (window.devicePixelRatio || 1) + fontSize) {
            continue;
          }

          // Get or generate character
          if (!column.chars[i]) {
            column.chars[i] = getRandomChar();
          }

          // Occasionally change character
          if (Math.random() < 0.01) {
            column.chars[i] = getRandomChar();
          }

          // Head of column is brighter (clean cyberpunk look)
          if (i === 0) {
            ctx.fillStyle = CYAN_BRIGHT;
          } else {
            // Fade from bright to dim
            const opacity = 1 - (i / column.length);
            ctx.fillStyle = CYAN_DIM;
            ctx.globalAlpha = opacity;
          }

          ctx.fillText(column.chars[i], column.x, charY);
          ctx.globalAlpha = 1;
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [intensity, isPaused]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full absolute inset-0"
      style={{ background: BG_COLOR }}
      data-testid="digital-rain-canvas"
    />
  );
}
