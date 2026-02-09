import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Building2, DollarSign, Users, Cpu, Scale, Leaf } from "lucide-react";
import { PESTLEFactors, TrendClaim } from "@/types/trend-analysis";
import { useState } from "react";

interface PESTLEFactorsViewProps {
  factors: PESTLEFactors;
}

const PESTLE_CONFIG = {
  political: {
    label: 'Political',
    color: 'bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800',
    badgeColor: 'bg-red-500 text-white' as const,
    icon: Building2,
  },
  economic: {
    label: 'Economic',
    color: 'bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800',
    badgeColor: 'bg-green-500 text-white' as const,
    icon: DollarSign,
  },
  social: {
    label: 'Social',
    color: 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800',
    badgeColor: 'bg-blue-500 text-white' as const,
    icon: Users,
  },
  technological: {
    label: 'Technological',
    color: 'bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-100 border-purple-200 dark:border-purple-800',
    badgeColor: 'bg-purple-500 text-white' as const,
    icon: Cpu,
  },
  legal: {
    label: 'Legal',
    color: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800',
    badgeColor: 'bg-amber-500 text-white' as const,
    icon: Scale,
  },
  environmental: {
    label: 'Environmental',
    color: 'bg-teal-100 dark:bg-teal-950 text-teal-900 dark:text-teal-100 border-teal-200 dark:border-teal-800',
    badgeColor: 'bg-teal-500 text-white' as const,
    icon: Leaf,
  },
};

const TIME_HORIZON_LABELS: Record<string, string> = {
  'short-term': 'Short-term',
  'medium-term': 'Medium-term',
  'long-term': 'Long-term',
};

export function PESTLEFactorsView({ factors }: PESTLEFactorsViewProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const renderClaim = (claim: TrendClaim, index: number, category: string) => {
    const config = PESTLE_CONFIG[category as keyof typeof PESTLE_CONFIG];
    
    return (
      <div
        key={index}
        className="border rounded-lg p-4 space-y-3"
        data-testid={`trend-claim-${category}-${index}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium flex-1" data-testid={`claim-text-${category}-${index}`}>
            {claim.claim}
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <Badge variant={claim.confidence === 'high' ? 'default' : claim.confidence === 'medium' ? 'secondary' : 'outline'}>
              {claim.confidence}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {TIME_HORIZON_LABELS[claim.timeHorizon] || claim.timeHorizon}
            </Badge>
          </div>
        </div>

        {claim.rationale && (
          <p className="text-sm text-muted-foreground" data-testid={`claim-rationale-${category}-${index}`}>
            {claim.rationale}
          </p>
        )}

        {claim.evidence && claim.evidence.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Evidence:</p>
            <ul className="text-xs space-y-1">
              {claim.evidence.map((evidence, i) => (
                <li key={i} className="text-muted-foreground" data-testid={`claim-evidence-${category}-${index}-${i}`}>
                  • {evidence}
                </li>
              ))}
            </ul>
          </div>
        )}

        {claim.sources && claim.sources.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <p className="text-xs font-semibold text-muted-foreground">Sources:</p>
            {claim.sources.map((source, i) => (
              <Badge key={i} variant="outline" className="text-xs" data-testid={`claim-source-${category}-${index}-${i}`}>
                {source}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card data-testid="card-pestle-factors">
      <CardHeader>
        <CardTitle className="text-2xl">PESTLE Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(factors).map(([category, claims]) => {
          const config = PESTLE_CONFIG[category as keyof typeof PESTLE_CONFIG];
          const Icon = config.icon;
          const isExpanded = expandedCategories[category] ?? true;

          return (
            <Collapsible
              key={category}
              open={isExpanded}
              onOpenChange={() => toggleCategory(category)}
            >
              <CollapsibleTrigger asChild>
                <div
                  className={`flex items-center justify-between p-4 rounded-lg cursor-pointer border-2 ${config.color}`}
                  data-testid={`pestle-category-${category}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${config.badgeColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{config.label}</h3>
                      <p className="text-sm opacity-80">
                        {claims.length} trend{claims.length !== 1 ? 's' : ''} identified
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-3">
                {claims.length > 0 ? (
                  claims.map((claim: TrendClaim, index: number) => renderClaim(claim, index, category))
                ) : (
                  <p className="text-sm text-muted-foreground italic">No trends identified in this category</p>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
