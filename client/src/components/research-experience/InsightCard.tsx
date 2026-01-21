import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export interface InsightCardData {
  id: string;
  category: string;
  headline: string;
  summary: string;
  confidence: number;
  sourcesCount?: number;
}

interface InsightCardProps {
  insight: InsightCardData;
  index: number;
  prefersReducedMotion: boolean;
}

const categoryColors: Record<string, string> = {
  market_dynamics: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  competitive_landscape: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  buyer_behavior: "bg-green-500/20 text-green-700 dark:text-green-300",
  regulatory_factors: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  language_preferences: "bg-pink-500/20 text-pink-700 dark:text-pink-300",
  default: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
};

const categoryLabels: Record<string, string> = {
  market_dynamics: "Market Dynamics",
  competitive_landscape: "Competition",
  buyer_behavior: "Buyer Behavior",
  regulatory_factors: "Regulatory",
  language_preferences: "Cultural",
};

export function InsightCard({ insight, index, prefersReducedMotion }: InsightCardProps) {
  const categoryColor = categoryColors[insight.category] || categoryColors.default;
  const categoryLabel = categoryLabels[insight.category] || insight.category;

  const variants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: index * 0.1,
      },
    },
    exit: {
      opacity: 0,
      x: -100,
      transition: { duration: 0.2 },
    },
  };

  return (
    <motion.div
      variants={prefersReducedMotion ? {} : variants}
      initial={prefersReducedMotion ? {} : "hidden"}
      animate="visible"
      exit={prefersReducedMotion ? {} : "exit"}
      layout
      data-testid={`insight-card-${insight.id}`}
    >
      <Card className="relative overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge variant="secondary" className={categoryColor}>
              {categoryLabel}
            </Badge>
            <div className="flex items-center gap-2">
              {insight.sourcesCount !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {insight.sourcesCount} sources
                </span>
              )}
              <div className="flex items-center gap-1">
                <div
                  className="h-2 w-16 bg-muted rounded-full overflow-hidden"
                  data-testid={`confidence-bar-${insight.id}`}
                >
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(insight.confidence || 0) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round((insight.confidence || 0) * 100)}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <h4 className="font-semibold text-sm flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="flex-1">{insight.headline}</span>
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {insight.summary}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
