import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  Truck, 
  Users, 
  RefreshCw, 
  Swords, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Target
} from "lucide-react";

interface PortersResultsProps {
  portersData: {
    threatOfNewEntrants: { score: number; analysis: string; barriers: string[]; risks: string[] };
    bargainingPowerOfSuppliers: { score: number; analysis: string; mitigations: string[]; risks: string[] };
    bargainingPowerOfBuyers: { score: number; analysis: string; risks: string[] };
    threatOfSubstitutes: { score: number; analysis: string; substitutes: string[]; risks: string[] };
    competitiveRivalry: { score: number; analysis: string; competitors: string[]; strategies: string[]; risks: string[] };
    overallAttractiveness: { score: number; summary: string; recommendations: string[] };
    strategicImplications: string[];
  };
  onContinue?: () => void;
}

function getScoreColor(score: number): string {
  if (score <= 3) return "bg-green-500";
  if (score <= 6) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreLabel(score: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (score <= 3) return { label: "Low", variant: "secondary" };
  if (score <= 6) return { label: "Moderate", variant: "default" };
  return { label: "High", variant: "destructive" };
}

function getAttractivenessColor(score: number): string {
  if (score >= 7) return "bg-green-500";
  if (score >= 4) return "bg-yellow-500";
  return "bg-red-500";
}

function getAttractivenessLabel(score: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (score >= 7) return { label: "Attractive", variant: "secondary" };
  if (score >= 4) return { label: "Moderately Attractive", variant: "default" };
  return { label: "Unattractive", variant: "destructive" };
}

interface ScoreGaugeProps {
  score: number;
  label: string;
  invertColors?: boolean;
}

function ScoreGauge({ score, label, invertColors = false }: ScoreGaugeProps) {
  const percentage = (score / 10) * 100;
  const colorClass = invertColors ? getAttractivenessColor(score) : getScoreColor(score);
  const scoreInfo = invertColors ? getAttractivenessLabel(score) : getScoreLabel(score);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{score}/10</span>
          <Badge variant={scoreInfo.variant}>{scoreInfo.label}</Badge>
        </div>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div 
          className={`h-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ForceCardProps {
  title: string;
  icon: React.ReactNode;
  score: number;
  analysis: string;
  items: { label: string; values: string[] }[];
  risks: string[];
}

function ForceCard({ title, icon, score, analysis, items, risks }: ForceCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreGauge score={score} label="Threat Level" />
        
        <p className="text-sm text-muted-foreground">{analysis}</p>
        
        {items.map((item, idx) => (
          item.values.length > 0 && (
            <div key={idx} className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                {item.label}
              </h4>
              <ul className="space-y-1 pl-6">
                {item.values.slice(0, 4).map((value, i) => (
                  <li key={i} className="text-sm text-muted-foreground list-disc">
                    {value}
                  </li>
                ))}
                {item.values.length > 4 && (
                  <li className="text-xs text-muted-foreground italic">
                    + {item.values.length - 4} more
                  </li>
                )}
              </ul>
            </div>
          )
        ))}
        
        {risks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Key Risks
            </h4>
            <ul className="space-y-1 pl-6">
              {risks.slice(0, 3).map((risk, i) => (
                <li key={i} className="text-sm text-muted-foreground list-disc">
                  {risk}
                </li>
              ))}
              {risks.length > 3 && (
                <li className="text-xs text-muted-foreground italic">
                  + {risks.length - 3} more risks
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PortersResults({ portersData, onContinue }: PortersResultsProps) {
  const {
    threatOfNewEntrants,
    bargainingPowerOfSuppliers,
    bargainingPowerOfBuyers,
    threatOfSubstitutes,
    competitiveRivalry,
    overallAttractiveness,
    strategicImplications
  } = portersData;

  const forces = [
    {
      title: "Threat of New Entrants",
      icon: <Shield className="h-5 w-5" />,
      score: threatOfNewEntrants.score,
      analysis: threatOfNewEntrants.analysis,
      items: [{ label: "Entry Barriers", values: threatOfNewEntrants.barriers }],
      risks: threatOfNewEntrants.risks
    },
    {
      title: "Supplier Power",
      icon: <Truck className="h-5 w-5" />,
      score: bargainingPowerOfSuppliers.score,
      analysis: bargainingPowerOfSuppliers.analysis,
      items: [{ label: "Mitigations", values: bargainingPowerOfSuppliers.mitigations }],
      risks: bargainingPowerOfSuppliers.risks
    },
    {
      title: "Buyer Power",
      icon: <Users className="h-5 w-5" />,
      score: bargainingPowerOfBuyers.score,
      analysis: bargainingPowerOfBuyers.analysis,
      items: [],
      risks: bargainingPowerOfBuyers.risks
    },
    {
      title: "Threat of Substitutes",
      icon: <RefreshCw className="h-5 w-5" />,
      score: threatOfSubstitutes.score,
      analysis: threatOfSubstitutes.analysis,
      items: [{ label: "Substitutes Identified", values: threatOfSubstitutes.substitutes }],
      risks: threatOfSubstitutes.risks
    },
    {
      title: "Competitive Rivalry",
      icon: <Swords className="h-5 w-5" />,
      score: competitiveRivalry.score,
      analysis: competitiveRivalry.analysis,
      items: [
        { label: "Key Competitors", values: competitiveRivalry.competitors },
        { label: "Competitive Strategies", values: competitiveRivalry.strategies }
      ],
      risks: competitiveRivalry.risks
    }
  ];

  // Calculate average force score for summary
  const avgForceScore = (
    threatOfNewEntrants.score +
    bargainingPowerOfSuppliers.score +
    bargainingPowerOfBuyers.score +
    threatOfSubstitutes.score +
    competitiveRivalry.score
  ) / 5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle>Porter's Five Forces Analysis</CardTitle>
              <CardDescription>
                Comprehensive industry competitive dynamics assessment
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <ScoreGauge 
                score={overallAttractiveness.score} 
                label="Market Attractiveness" 
                invertColors={true}
              />
              <ScoreGauge 
                score={Math.round(avgForceScore * 10) / 10} 
                label="Average Competitive Pressure" 
              />
            </div>
            <div className="flex items-center">
              <p className="text-sm text-muted-foreground">
                {overallAttractiveness.summary}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Five Forces Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {forces.map((force, idx) => (
          <ForceCard key={idx} {...force} />
        ))}
      </div>

      {/* Strategic Recommendations */}
      {overallAttractiveness.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Strategic Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {overallAttractiveness.recommendations.map((rec, idx) => (
                <div 
                  key={idx} 
                  className="flex gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900"
                >
                  <Badge className="shrink-0 h-6 bg-green-600">{idx + 1}</Badge>
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategic Implications */}
      {strategicImplications.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg">Strategic Implications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {strategicImplications.map((implication, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{implication}</p>
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
            Continue to SWOT Analysis
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
