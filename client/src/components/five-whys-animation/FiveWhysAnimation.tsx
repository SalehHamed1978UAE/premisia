import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DigitalRain } from './DigitalRain';
import { ProgressBeam } from './ProgressBeam';
import { MatrixMessage } from './MatrixMessage';
import { Controls } from './Controls';
import { GeometricLoader } from '@/components/loaders/GeometricLoader';

interface FiveWhysAnimationProps {
  onComplete?: () => void;
  progress?: number; // SSE progress (0-100)
  currentMessage?: string; // SSE message
  sessionId?: string; // Session ID for SSE (future use)
}

const STAGES = [
  { id: 'parsing', label: 'Parsing Input', progress: [0, 15] as [number, number] },
  { id: 'root', label: 'Generating Root Question', progress: [15, 30] as [number, number] },
  { id: 'level1', label: 'Expanding Why Level 1', progress: [30, 50] as [number, number] },
  { id: 'level2', label: 'Expanding Why Level 2', progress: [50, 70] as [number, number] },
  { id: 'level3', label: 'Expanding Why Level 3', progress: [70, 90] as [number, number] },
  { id: 'analyzing', label: 'Analyzing Path Implications', progress: [90, 100] as [number, number] },
];

const STAGE_MESSAGES: Record<string, string> = {
  parsing: 'INPUT PARSED',
  root: 'ROOT QUESTION GENERATED',
  level1: 'LEVEL 1 EXPANDED',
  level2: 'LEVEL 2 EXPANDED',
  level3: 'LEVEL 3 EXPANDED',
  analyzing: 'ANALYSIS COMPLETE',
};

// Total animation duration in ms (25 seconds to match expected generation time)
const TOTAL_DURATION = 25000;

export function FiveWhysAnimation({ onComplete, progress, currentMessage: sseMessage, sessionId }: FiveWhysAnimationProps) {
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [showMessage, setShowMessage] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [useSimpleMode, setUseSimpleMode] = useState(false);
  
  const startTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number>();
  const hasCompletedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false
  );
  
  // Determine if using SSE mode (props provided) or fallback timer mode
  const useSSEMode = progress !== undefined;

  // Check for skip preference in localStorage
  useEffect(() => {
    const skipPref = localStorage.getItem('five-whys-skip-animation');
    if (skipPref === 'true') {
      setUseSimpleMode(true);
    }

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setUseSimpleMode(true);
      prefersReducedMotion.current = true;
    }
  }, []);

  // SSE Mode: Update progress from props
  useEffect(() => {
    if (!useSSEMode || progress === undefined) return;

    setCurrentProgress(progress);

    // Map progress to stage
    const newStageIndex = STAGES.findIndex(
      (stage) => progress >= stage.progress[0] && progress < stage.progress[1]
    );

    if (newStageIndex !== -1 && newStageIndex !== currentStageIndex) {
      setCurrentStageIndex(newStageIndex);
      
      // Show SSE message if provided
      if (sseMessage) {
        setCurrentMessage(sseMessage);
        setShowMessage(true);
        setTimeout(() => setShowMessage(false), 2000);
      }
    }

    // Check completion
    if (progress >= 100 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      if (sseMessage) {
        setCurrentMessage(sseMessage);
        setShowMessage(true);
      }
      setTimeout(() => {
        setShowMessage(false);
        onComplete?.();
      }, 2000);
    }
  }, [useSSEMode, progress, sseMessage, currentStageIndex, onComplete]);

  // Audio control: Play/pause based on sound enabled state
  useEffect(() => {
    if (!audioRef.current) return;

    if (isSoundEnabled && !prefersReducedMotion.current) {
      audioRef.current.play().catch((error) => {
        console.warn('Audio playback failed:', error);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isSoundEnabled]);

  // Progress animation loop (Timer Fallback Mode - only runs when NOT using SSE)
  useEffect(() => {
    if (useSimpleMode || hasCompletedRef.current || useSSEMode) {
      return;
    }

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / TOTAL_DURATION) * 100, 100);
      
      setCurrentProgress(progress);

      // Determine current stage
      const newStageIndex = STAGES.findIndex(
        (stage) => progress >= stage.progress[0] && progress < stage.progress[1]
      );
      
      if (newStageIndex !== -1 && newStageIndex !== currentStageIndex) {
        // Stage changed - show message
        const stage = STAGES[newStageIndex];
        if (currentStageIndex >= 0 && currentStageIndex < STAGES.length) {
          const prevStage = STAGES[currentStageIndex];
          setCurrentMessage(STAGE_MESSAGES[prevStage.id]);
          setShowMessage(true);
          
          // Hide message after 2 seconds
          setTimeout(() => {
            setShowMessage(false);
          }, 2000);
        }
        
        setCurrentStageIndex(newStageIndex);
      }

      // Check if complete
      if (progress >= 100 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        
        // Show final message
        setCurrentMessage(STAGE_MESSAGES[STAGES[STAGES.length - 1].id]);
        setShowMessage(true);
        
        // Call onComplete after showing final message
        setTimeout(() => {
          setShowMessage(false);
          onComplete?.();
        }, 2000);
        
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentStageIndex, useSimpleMode, useSSEMode, onComplete]);

  const handleSkip = () => {
    localStorage.setItem('five-whys-skip-animation', 'true');
    setUseSimpleMode(true);
    
    // Jump to completion
    if (!hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete?.();
    }
  };

  const handleToggleSound = () => {
    setIsSoundEnabled(prev => !prev);
  };

  // Calculate intensity based on stage (more intense as we progress)
  const intensity = Math.min(30 + currentStageIndex * 12, 100);

  // Simple mode fallback with geometric loader
  if (useSimpleMode) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8" data-testid="simple-mode-container">
        <Card className="w-full max-w-lg bg-card/95 backdrop-blur">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-6">
                <GeometricLoader type="fractal" size="medium" />
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold text-foreground">
                    Generating Five Whys Analysis
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="simple-stage-label">
                    {currentStageIndex >= 0 && currentStageIndex < STAGES.length
                      ? STAGES[currentStageIndex].label
                      : 'Processing...'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={currentProgress} className="h-2" data-testid="simple-progress-bar" />
                <p className="text-xs text-center text-muted-foreground">
                  {Math.round(currentProgress)}% Complete
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Full immersive Matrix animation mode
  return (
    <>
      {/* Ambient Audio - looped, controlled by sound toggle */}
      <audio 
        ref={audioRef} 
        loop 
        muted={!isSoundEnabled}
        data-testid="ambient-audio"
      >
        {/* Optional: Add ambient sound file here when available */}
        {/* <source src="/ambient-drone.mp3" type="audio/mpeg" /> */}
      </audio>

      <div className="fixed inset-0 w-full h-full overflow-hidden z-50" data-testid="five-whys-animation">
        {/* Background: Digital Rain */}
        <DigitalRain intensity={intensity} isPaused={false} />

      {/* Top: Progress Beam */}
      <ProgressBeam
        stages={STAGES}
        currentStage={currentStageIndex}
        currentProgress={currentProgress}
      />

      {/* Center: Matrix Messages */}
      <MatrixMessage message={currentMessage} show={showMessage} />

      {/* Bottom: Controls */}
      <Controls
        currentStage={currentStageIndex}
        totalStages={STAGES.length}
        stageLabel={currentStageIndex >= 0 && currentStageIndex < STAGES.length ? STAGES[currentStageIndex].label : ''}
        onSkip={handleSkip}
        isSoundEnabled={isSoundEnabled}
        onToggleSound={handleToggleSound}
      />
      </div>
    </>
  );
}
