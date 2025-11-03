import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const RESEARCH_PHASES = [
  { id: 'query-gen', label: 'Generating Queries', icon: '🔍', range: [0, 15] },
  { id: 'source-collection', label: 'Collecting Sources', icon: '📚', range: [15, 35] },
  { id: 'evidence-extraction', label: 'Extracting Evidence', icon: '💡', range: [35, 60] },
  { id: 'validation', label: 'Validating Contradictions', icon: '✓', range: [60, 80] },
  { id: 'synthesis', label: 'Synthesizing Insights', icon: '🧩', range: [80, 95] },
  { id: 'summary', label: 'Preparing Summary', icon: '📊', range: [95, 100] },
];

interface ProgressTimelineProps {
  progress: number;
  prefersReducedMotion: boolean;
}

export function ProgressTimeline({ progress, prefersReducedMotion }: ProgressTimelineProps) {
  const getCurrentPhaseIndex = () => {
    return RESEARCH_PHASES.findIndex(
      (phase) => progress >= phase.range[0] && progress < phase.range[1]
    );
  };

  const currentPhaseIndex = getCurrentPhaseIndex();
  
  const isPhaseComplete = (index: number) => {
    return progress > RESEARCH_PHASES[index].range[1];
  };

  const isCurrentPhase = (index: number) => {
    return index === currentPhaseIndex;
  };

  return (
    <div className="w-full">
      {/* Mobile: Vertical Timeline */}
      <div className="md:hidden space-y-4">
        {RESEARCH_PHASES.map((phase, index) => {
          const complete = isPhaseComplete(index);
          const current = isCurrentPhase(index);
          
          return (
            <motion.div
              key={phase.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                current && "bg-primary/10 border border-primary/20",
                complete && "opacity-60"
              )}
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              data-testid={`phase-${phase.id}`}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full text-xl transition-all",
                  complete && "bg-green-500/20",
                  current && "bg-primary/20 scale-110",
                  !complete && !current && "bg-muted"
                )}
              >
                {complete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" data-testid={`checkmark-${phase.id}`} />
                ) : (
                  <span>{phase.icon}</span>
                )}
              </div>
              <div className="flex-1">
                <p className={cn("text-sm font-medium", current && "text-primary")}>
                  {phase.label}
                </p>
                {current && (
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(progress)}% complete
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Desktop: Horizontal Timeline */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between relative">
          {/* Progress Bar */}
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-muted -translate-y-1/2 -z-10">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              data-testid="progress-bar"
            />
          </div>

          {RESEARCH_PHASES.map((phase, index) => {
            const complete = isPhaseComplete(index);
            const current = isCurrentPhase(index);

            return (
              <div key={phase.id} className="flex flex-col items-center gap-2 relative">
                <motion.div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full border-2 text-xl transition-all bg-background",
                    complete && "border-green-500 bg-green-500/20",
                    current && "border-primary bg-primary/20 scale-125 shadow-lg",
                    !complete && !current && "border-muted"
                  )}
                  initial={prefersReducedMotion ? {} : { scale: 0 }}
                  animate={prefersReducedMotion ? {} : { scale: complete || current ? 1.1 : 1 }}
                  transition={{
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  data-testid={`phase-${phase.id}`}
                >
                  {complete ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" data-testid={`checkmark-${phase.id}`} />
                  ) : (
                    <span>{phase.icon}</span>
                  )}
                </motion.div>
                <div className="text-center max-w-[120px]">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      current && "text-primary font-semibold"
                    )}
                  >
                    {phase.label}
                  </p>
                  {current && (
                    <motion.p
                      className="text-xs text-muted-foreground mt-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {Math.floor(progress)}%
                    </motion.p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
