import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';

interface ControlsProps {
  currentStage: number;
  totalStages: number;
  stageLabel: string;
  onSkip: () => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
}

export function Controls({
  currentStage,
  totalStages,
  stageLabel,
  onSkip,
  isSoundEnabled,
  onToggleSound,
}: ControlsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent z-10">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Progress text */}
        <div className="flex-1 min-w-0">
          <p className="text-green-400 font-mono text-sm sm:text-base truncate" data-testid="progress-text">
            <span className="text-green-500 font-semibold">Stage {currentStage + 1} of {totalStages}:</span>{' '}
            {stageLabel}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Sound toggle - optional */}
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleSound}
            className="border-green-500/30 bg-black/50 hover:bg-green-900/30 hover:border-green-500"
            data-testid="button-toggle-sound"
            title={isSoundEnabled ? 'Mute ambient sound' : 'Enable ambient sound'}
          >
            {isSoundEnabled ? (
              <Volume2 className="h-4 w-4 text-green-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-green-600" />
            )}
          </Button>

          {/* Skip button */}
          <Button
            variant="outline"
            onClick={onSkip}
            className="border-green-500/30 bg-black/50 hover:bg-green-900/30 hover:border-green-500 text-green-400 hover:text-green-300 font-mono"
            data-testid="button-skip-animation"
          >
            Skip Animation
          </Button>
        </div>
      </div>
    </div>
  );
}
