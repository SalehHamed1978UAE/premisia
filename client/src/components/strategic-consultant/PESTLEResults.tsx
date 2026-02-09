import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Globe, 
  TrendingUp, 
  Users, 
  Cpu, 
  Scale, 
  Leaf,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Clock,
  Target,
  Zap
} from "lucide-react";

interface PESTLETrend {
  description: string;
  strength: number;
  timeframe: string;
  impact: string;
}

interface PESTLEOpportunity {
  description: string;
}

interface PESTLERisk {
  description: string;
  probability: number;
  impact: string;
}

interface PESTLEFactor {
  trends: PESTLETrend[];
  opportunities: PESTLEOpportunity[];
  risks: PESTLERisk[];
}

interface PESTLEResultsProps {
  pestleData: {
    political: PESTLEFactor;
    economic: PESTLEFactor;
    social: PESTLEFactor;
    technological: PESTLEFactor;
    legal: PESTLEFactor;
    environmental: PESTLEFactor;
    strategicRecommendations: string[];
    crossFactorInsights: {
      synergies: string[];
      conflicts: string[];
    };
  };
  onContinue?: () => void;
}

const factorConfig = {
  political: { 
    label: "Political", 
    icon: Globe, 
    color: "blue",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    badgeColor: "bg-blue-100 text-blue-800"
  },
  economic: { 
    label: "Economic", 
    icon: TrendingUp, 
    color: "green",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    textColor: "text-green-700",
    badgeColor: "bg-green-100 text-green-800"
  },
  social: { 
    label: "Social", 
    icon: Users, 
    color: "purple",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-700",
    badgeColor: "bg-purple-100 text-purple-800"
  },
  technological: { 
    label: "Technological", 
    icon: Cpu, 
    color: "orange",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-700",
    badgeColor: "bg-orange-100 text-orange-800"
  },
  legal: { 
    label: "Legal", 
    icon: Scale, 
    color: "red",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-700",
    badgeColor: "bg-red-100 text-red-800"
  },
  environmental: { 
    label: "Environmental", 
    icon: Leaf, 
    color: "teal",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    textColor: "text-teal-700",
    badgeColor: "bg-teal-100 text-teal-800"
  },
} as const;

function getStrengthBadge(strength: number) {
  if (strength >= 8) return { label: "High", variant: "destructive" as const };
  if (strength >= 5) return { label: "Medium", variant: "secondary" as const };
  return { label: "Low", variant: "outline" as const };
}

function getImpactBadge(impact: string) {
  const normalized = impact.toLowerCase();
  if (normalized === "high" || normalized === "major") {
    return { variant: "destructive" as const };
  }
  if (normalized === "medium" || normalized === "moderate") {
    return { variant: "secondary" as const };
  }
  return { variant: "outline" as const };
}

function FactorSection({ 
  factorKey, 
  factorData 
}: { 
  factorKey: keyof typeof factorConfig; 
  factorData: PESTLEFactor;
}) {
  const config = factorConfig[factorKey];
  const Icon = config.icon;
  const { trends = [], opportunities = [], risks = [] } = factorData || {};

  return (
    <Card className={`${config.borderColor} border-l-4`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`h-5 w-5 ${config.textColor}`} />
          </div>
          <CardTitle className="text-lg">{config.label} Factors</CardTitle>
          <Badge className={config.badgeColor}>
            {trends.length} trends
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trends */}
        {trends.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Key Trends
            </h4>
            <div className="space-y-2">
              {trends.map((trend, idx) => (
                <div 
                  key={idx} 
                  className="p-3 rounded-lg bg-muted/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm flex-1">{trend.description}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant={getStrengthBadge(trend.strength).variant}>
                        {trend.strength}/10
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {trend.timeframe}
                    </span>
                    <span>•</span>
                    <Badge variant={getImpactBadge(trend.impact).variant} className="text-xs">
                      {trend.impact} impact
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities */}
        {opportunities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              Opportunities
            </h4>
            <ul className="space-y-1">
              {opportunities.map((opp, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  {opp.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        {risks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Risks
            </h4>
            <ul className="space-y-2">
              {risks.map((risk, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <Badge variant="destructive" className="shrink-0 mt-0.5 text-xs">
                    {Math.round(risk.probability * 100)}%
                  </Badge>
                  <span className="text-muted-foreground flex-1">
                    {risk.description}
                    <Badge variant={getImpactBadge(risk.impact).variant} className="ml-2 text-xs">
                      {risk.impact}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {trends.length === 0 && opportunities.length === 0 && risks.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No {config.label.toLowerCase()} factors identified
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PESTLEResults({ pestleData, onContinue }: PESTLEResultsProps) {
  const factors: (keyof typeof factorConfig)[] = [
    "political",
    "economic", 
    "social",
    "technological",
    "legal",
    "environmental"
  ];

  const { strategicRecommendations = [], crossFactorInsights } = pestleData || {};
  const synergies = crossFactorInsights?.synergies || [];
  const conflicts = crossFactorInsights?.conflicts || [];

  const totalTrends = factors.reduce((sum, f) => 
    sum + (pestleData?.[f]?.trends?.length || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>PESTLE Analysis Results</CardTitle>
              <CardDescription>
                Macro-environmental analysis identified {totalTrends} key trends across 6 factors
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Factor Sections Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {factors.map((factor) => (
          <FactorSection 
            key={factor} 
            factorKey={factor} 
            factorData={pestleData?.[factor] || { trends: [], opportunities: [], risks: [] }} 
          />
        ))}
      </div>

      {/* Cross-Factor Insights */}
      {(synergies.length > 0 || conflicts.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">Cross-Factor Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {synergies.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-green-700">Synergies</h4>
                <ul className="space-y-1">
                  {synergies.map((synergy, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-600 mt-1">✓</span>
                      {synergy}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-red-700">Conflicts</h4>
                <ul className="space-y-1">
                  {conflicts.map((conflict, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-red-600 mt-1">⚠</span>
                      {conflict}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strategic Recommendations */}
      {strategicRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">Strategic Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {strategicRecommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Badge variant="secondary" className="shrink-0 h-6">
                    {idx + 1}
                  </Badge>
                  <p className="text-sm text-foreground">{rec}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Continue Button */}
      {onContinue && (
        <div className="flex justify-end">
          <Button onClick={onContinue} className="gap-2">
            Continue to Porter's Analysis
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
