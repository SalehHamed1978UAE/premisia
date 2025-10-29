import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PlanningStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  durationSeconds?: number;
}

interface PlanningProgressTrackerProps {
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function PlanningProgressTracker({ 
  onComplete, 
  onError 
}: PlanningProgressTrackerProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>('Initializing...');
  const [steps, setSteps] = useState<PlanningStep[]>([
    { id: 'wbs-generation', name: 'Generating Workstreams', description: 'Creating strategic workstreams from analysis', status: 'pending' },
    { id: 'extract-tasks', name: 'Extracting Tasks', description: 'Breaking down workstreams into detailed tasks', status: 'pending' },
    { id: 'schedule', name: 'Building Schedule', description: 'Creating timeline with Critical Path Method', status: 'pending' },
    { id: 'allocate-resources', name: 'Allocating Resources', description: 'Matching skills to tasks', status: 'pending' },
    { id: 'level-resources', name: 'Optimizing Resources', description: 'Resolving conflicts and leveling workload', status: 'pending' },
    { id: 'optimize', name: 'AI Optimization', description: 'Optimizing timeline and efficiency', status: 'pending' },
    { id: 'validate', name: 'Final Validation', description: 'Quality checks and confidence scoring', status: 'pending' }
  ]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer for elapsed time
  useEffect(() => {
    if (isComplete || error) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isComplete, error]);

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" data-testid={`icon-complete`} />;
      case 'in-progress':
        return <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-500 animate-spin" data-testid={`icon-in-progress`} />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500" data-testid={`icon-error`} />;
      default:
        return <Clock className="h-5 w-5 text-gray-400 dark:text-gray-600" data-testid={`icon-pending`} />;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Public method to update progress (called from parent)
  useEffect(() => {
    // Expose update function via ref if needed
    (window as any).__updatePlanningProgress = (event: any) => {
      switch (event.type) {
        case 'step-start':
          setProgress(event.progress || 0);
          setCurrentStep(event.description || '');
          // Only update elapsed time if event provides it AND it's valid (don't reset to 0)
          if (event.elapsedSeconds !== undefined && event.elapsedSeconds > 0) {
            setElapsedTime(event.elapsedSeconds);
          }

          setSteps(prev => prev.map(step =>
            step.id === event.step
              ? { ...step, status: 'in-progress' }
              : step.status === 'in-progress'
              ? { ...step, status: 'complete' }
              : step
          ));
          break;

        case 'step-complete':
          setSteps(prev => prev.map(step =>
            step.id === event.step
              ? { ...step, status: 'complete', durationSeconds: event.durationSeconds }
              : step
          ));
          break;

        case 'complete':
          setProgress(100);
          setSteps(prev => prev.map(step => ({ ...step, status: step.status === 'pending' ? 'pending' : 'complete' })));
          setIsComplete(true);
          if (onComplete) onComplete();
          break;

        case 'error':
          setSteps(prev => prev.map(step =>
            step.status === 'in-progress'
              ? { ...step, status: 'error' }
              : step
          ));
          setError(event.message || 'An error occurred');
          if (onError) onError(event.message);
          break;
      }
    };

    return () => {
      delete (window as any).__updatePlanningProgress;
    };
  }, [onComplete, onError]);

  return (
    <Card className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col" data-testid="planning-progress-tracker">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          {!isComplete && !error && <Loader2 className="h-5 w-5 animate-spin" />}
          {isComplete && <CheckCircle2 className="h-5 w-5 text-green-600" />}
          {error && <AlertCircle className="h-5 w-5 text-red-600" />}
          Creating Your Program Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 overflow-y-auto flex-1">

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" data-testid="error-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium" data-testid="progress-percentage">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" data-testid="progress-bar" />
        </div>

        {/* Current Status */}
        <div className="rounded-lg bg-muted/50 dark:bg-muted/20 p-4" data-testid="current-status">
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Current Step
          </div>
          <p className="text-sm text-muted-foreground">{currentStep}</p>
        </div>

        {/* Steps List */}
        <div className="space-y-2 sm:space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-colors hover:bg-muted/50 dark:hover:bg-muted/20"
              data-testid={`step-${step.id}`}
            >
              <div className="mt-0.5 flex-shrink-0">{getStepIcon(step.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-medium truncate">
                    {index + 1}. {step.name}
                  </h4>
                  {step.durationSeconds !== undefined && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {step.durationSeconds}s
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 sm:line-clamp-none">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Time and Estimate */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 text-xs sm:text-sm text-muted-foreground border-t pt-3 sm:pt-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span data-testid="elapsed-time">Elapsed: {formatTime(elapsedTime)}</span>
          </div>
          {!isComplete && !error && (
            <span className="text-xs">Estimated: Approx. 10 minutes</span>
          )}
          {isComplete && (
            <span className="text-xs text-green-600 dark:text-green-500 font-medium">
              Completed!
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
