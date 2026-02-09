import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { FileSearch, BookOpen, AlertTriangle } from "lucide-react";

interface StatsPanelProps {
  sourcesScanned: number;
  articlesAnalyzed: number;
  contradictionsFlagged: number;
  prefersReducedMotion: boolean;
}

function AnimatedCounter({
  value,
  duration = 1,
}: {
  value: number;
  duration?: number;
}) {
  const spring = useSpring(0, { stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => Math.round(current));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = display.on("change", (latest) => {
      setDisplayValue(latest);
    });
    return () => unsubscribe();
  }, [display]);

  return <span>{displayValue}</span>;
}

export function StatsPanel({
  sourcesScanned,
  articlesAnalyzed,
  contradictionsFlagged,
  prefersReducedMotion,
}: StatsPanelProps) {
  const stats = [
    {
      label: "Sources Scanned",
      value: sourcesScanned,
      icon: FileSearch,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Articles Analyzed",
      value: articlesAnalyzed,
      icon: BookOpen,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Contradictions Flagged",
      value: contradictionsFlagged,
      icon: AlertTriangle,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-3" data-testid="stats-panel">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        
        return (
          <motion.div
            key={stat.label}
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>
                      {prefersReducedMotion ? (
                        stat.value
                      ) : (
                        <AnimatedCounter value={stat.value} />
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
