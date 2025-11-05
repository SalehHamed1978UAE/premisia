import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Maximize2, X } from "lucide-react";

interface MinimizedJobTrackerProps {
  progress: number;
  message: string;
  title?: string;
  onExpand: () => void;
  onDismiss: () => void;
}

export function MinimizedJobTracker({ 
  progress, 
  message, 
  title = 'EPM Generation',
  onExpand, 
  onDismiss 
}: MinimizedJobTrackerProps) {
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-40" 
        data-testid="minimized-tracker-backdrop"
      />
      <div 
        className="fixed top-4 right-4 w-80 bg-card dark:bg-gray-900 border rounded-lg shadow-lg z-50 p-3 opacity-100"
        data-testid="minimized-job-tracker"
        style={{ backgroundColor: 'var(--card)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
            <span className="text-sm font-medium truncate">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onExpand}
              className="h-6 w-6"
              data-testid="button-expand-tracker"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-6 w-6"
              data-testid="button-dismiss-tracker"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <Progress value={progress} className="h-1" />
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {progress}% - {message}
        </p>
      </div>
    </>
  );
}
