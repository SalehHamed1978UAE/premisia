import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";

interface TrendProgressViewProps {
  phase: string;
  message: string;
  step: number;
  totalSteps: number;
  isComplete: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  domain_extraction: 'Extracting Domain Context',
  pestle_generation: 'Generating PESTLE Analysis',
  assumption_comparison: 'Comparing with Assumptions',
  synthesis: 'Synthesizing Insights',
};

export function TrendProgressView({ phase, message, step, totalSteps, isComplete }: TrendProgressViewProps) {
  const progress = totalSteps > 0 ? (step / totalSteps) * 100 : 0;

  return (
    <Card data-testid="card-trend-progress">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl" data-testid="text-progress-title">
              Trend Analysis in Progress
            </CardTitle>
            <CardDescription>
              AI-powered PESTLE analysis with evidence-based insights
            </CardDescription>
          </div>
          {isComplete ? (
            <Badge variant="default" className="gap-1" data-testid="badge-complete">
              <CheckCircle2 className="h-4 w-4" />
              Complete
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1" data-testid="badge-analyzing">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Phase */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium" data-testid="text-current-phase">
              {PHASE_LABELS[phase] || 'Processing...'}
            </span>
            <span className="text-muted-foreground" data-testid="text-step-counter">
              Step {step} of {totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-2" data-testid="progress-bar" />
        </div>

        {/* Status Message */}
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm" data-testid="text-status-message">
            {message || 'Starting analysis...'}
          </p>
        </div>

        {/* Phase Indicators */}
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(PHASE_LABELS).map(([phaseKey, label], index) => {
            const isActive = phase === phaseKey;
            const isPast = Object.keys(PHASE_LABELS).indexOf(phase) > index;
            
            return (
              <div
                key={phaseKey}
                className={`text-center p-2 rounded-md text-xs ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isPast
                    ? 'bg-muted text-muted-foreground line-through'
                    : 'bg-muted/50 text-muted-foreground'
                }`}
                data-testid={`phase-indicator-${phaseKey}`}
              >
                {label.replace('Generating ', '').replace('Extracting ', '').replace('Comparing with ', '').replace('Synthesizing ', '')}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
