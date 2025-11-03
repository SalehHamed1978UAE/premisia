import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Stage {
  id: string;
  label: string;
  progress: [number, number];
}

interface ProgressBeamProps {
  stages: Stage[];
  currentStage: number; // 0-based index
  currentProgress: number; // 0-100
}

export function ProgressBeam({ stages, currentStage, currentProgress }: ProgressBeamProps) {
  return (
    <TooltipProvider>
      <div className="w-full" data-testid="progress-beam">
        {/* Desktop: Horizontal beam */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-3 bg-black/80 border-b border-green-500/30">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStage;
            const isActive = index === currentStage;
            const isFuture = index > currentStage;

            return (
              <Tooltip key={stage.id}>
                <TooltipTrigger asChild>
                  <div
                    className="flex-1 relative h-2 rounded-full overflow-hidden bg-black/50 border border-green-900/30"
                    data-testid={`stage-${index}`}
                  >
                    {/* Progress bar */}
                    <div
                      className={`h-full transition-all duration-300 ${
                        isCompleted
                          ? 'bg-green-500 w-full'
                          : isActive
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-transparent w-0'
                      }`}
                      style={{
                        width: isActive ? `${((currentProgress - stage.progress[0]) / (stage.progress[1] - stage.progress[0])) * 100}%` : undefined,
                        boxShadow: isActive || isCompleted ? '0 0 10px rgba(0, 255, 0, 0.5)' : undefined,
                      }}
                      data-testid={`stage-progress-${index}`}
                    />
                    
                    {/* Glow effect for active stage */}
                    {isActive && (
                      <div className="absolute inset-0 bg-green-500/20 animate-pulse" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-black border-green-500 text-green-400"
                  data-testid={`stage-tooltip-${index}`}
                >
                  <p className="font-mono text-xs">{stage.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Mobile: Vertical beam */}
        <div className="sm:hidden flex flex-col gap-2 p-3 bg-black/80 border-b border-green-500/30">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStage;
            const isActive = index === currentStage;
            const isFuture = index > currentStage;

            return (
              <div key={stage.id} className="flex items-center gap-3" data-testid={`stage-mobile-${index}`}>
                {/* Status indicator */}
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500'
                      : isActive
                      ? 'bg-green-500 border-green-500 animate-pulse'
                      : 'bg-black border-green-900'
                  }`}
                  style={{
                    boxShadow: isActive || isCompleted ? '0 0 8px rgba(0, 255, 0, 0.6)' : undefined,
                  }}
                />
                
                {/* Stage label */}
                <span
                  className={`text-xs font-mono flex-1 ${
                    isActive ? 'text-green-400 font-semibold' : isCompleted ? 'text-green-600' : 'text-gray-600'
                  }`}
                >
                  {stage.label}
                </span>
                
                {/* Progress percentage for active stage */}
                {isActive && (
                  <span className="text-xs font-mono text-green-400">
                    {Math.round(((currentProgress - stage.progress[0]) / (stage.progress[1] - stage.progress[0])) * 100)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
