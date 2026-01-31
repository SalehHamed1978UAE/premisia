import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Lightbulb, 
  AlertTriangle,
  Target,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

interface SWOTFactor {
  factor: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  evidence?: string;
}

interface SWOTResultsProps {
  swotData: {
    strengths: SWOTFactor[];
    weaknesses: SWOTFactor[];
    opportunities: SWOTFactor[];
    threats: SWOTFactor[];
    strategicOptions: {
      soStrategies: string[];
      woStrategies: string[];
      stStrategies: string[];
      wtStrategies: string[];
    };
    priorityActions: string[];
    confidence: number;
  };
  onContinue?: () => void;
}

function ImportanceBadge({ importance }: { importance: 'high' | 'medium' | 'low' }) {
  const variants: Record<string, { className: string; label: string }> = {
    high: { className: 'bg-red-100 text-red-700 border-red-200', label: 'High' },
    medium: { className: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Medium' },
    low: { className: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Low' },
  };
  
  const variant = variants[importance] || variants.low;
  
  return (
    <Badge variant="outline" className={`text-xs ${variant.className}`}>
      {variant.label}
    </Badge>
  );
}

function FactorCard({ factor, colorClass }: { factor: SWOTFactor; colorClass: string }) {
  return (
    <div className={`p-3 rounded-lg border ${colorClass} space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <h5 className="font-medium text-sm">{factor.factor}</h5>
        <ImportanceBadge importance={factor.importance} />
      </div>
      <p className="text-xs text-muted-foreground">{factor.description}</p>
      {factor.evidence && (
        <p className="text-xs italic text-muted-foreground/80 border-t pt-2 mt-2">
          Evidence: {factor.evidence}
        </p>
      )}
    </div>
  );
}

function QuadrantSection({ 
  title, 
  icon: Icon, 
  factors, 
  headerClass, 
  cardClass,
  emptyMessage 
}: { 
  title: string;
  icon: React.ElementType;
  factors: SWOTFactor[];
  headerClass: string;
  cardClass: string;
  emptyMessage: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2 p-3 rounded-t-lg ${headerClass}`}>
        <Icon className="h-4 w-4" />
        <h4 className="font-semibold text-sm">{title}</h4>
        <Badge variant="secondary" className="ml-auto text-xs">
          {factors.length}
        </Badge>
      </div>
      <div className={`flex-1 p-3 rounded-b-lg border border-t-0 space-y-2 min-h-[200px] ${cardClass}`}>
        {factors.length > 0 ? (
          factors.map((factor, idx) => (
            <FactorCard key={idx} factor={factor} colorClass={cardClass} />
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic text-center py-8">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function StrategySection({ 
  title, 
  strategies, 
  colorClass 
}: { 
  title: string;
  strategies: string[];
  colorClass: string;
}) {
  if (strategies.length === 0) return null;
  
  return (
    <div className={`p-4 rounded-lg border ${colorClass}`}>
      <h5 className="font-semibold text-sm mb-3">{title}</h5>
      <ul className="space-y-2">
        {strategies.map((strategy, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <span>{strategy}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SWOTResults({ swotData, onContinue }: SWOTResultsProps) {
  const { 
    strengths, 
    weaknesses, 
    opportunities, 
    threats, 
    strategicOptions, 
    priorityActions,
    confidence 
  } = swotData;

  const totalFactors = strengths.length + weaknesses.length + opportunities.length + threats.length;
  const hasStrategicOptions = 
    strategicOptions.soStrategies.length > 0 ||
    strategicOptions.woStrategies.length > 0 ||
    strategicOptions.stStrategies.length > 0 ||
    strategicOptions.wtStrategies.length > 0;

  return (
    <div className="space-y-6">
      {/* Main SWOT Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle>SWOT Analysis</CardTitle>
                <CardDescription>
                  Identified {totalFactors} strategic factors across 4 dimensions
                </CardDescription>
              </div>
            </div>
            {confidence > 0 && (
              <Badge variant="outline" className="text-xs">
                {Math.round(confidence * 100)}% confidence
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 2x2 SWOT Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths - Top Left */}
            <QuadrantSection
              title="Strengths"
              icon={TrendingUp}
              factors={strengths}
              headerClass="bg-green-600 text-white"
              cardClass="bg-green-50/50 border-green-200"
              emptyMessage="No strengths identified"
            />
            
            {/* Weaknesses - Top Right */}
            <QuadrantSection
              title="Weaknesses"
              icon={TrendingDown}
              factors={weaknesses}
              headerClass="bg-red-500 text-white"
              cardClass="bg-red-50/50 border-red-200"
              emptyMessage="No weaknesses identified"
            />
            
            {/* Opportunities - Bottom Left */}
            <QuadrantSection
              title="Opportunities"
              icon={Lightbulb}
              factors={opportunities}
              headerClass="bg-blue-600 text-white"
              cardClass="bg-blue-50/50 border-blue-200"
              emptyMessage="No opportunities identified"
            />
            
            {/* Threats - Bottom Right */}
            <QuadrantSection
              title="Threats"
              icon={AlertTriangle}
              factors={threats}
              headerClass="bg-amber-500 text-white"
              cardClass="bg-amber-50/50 border-amber-200"
              emptyMessage="No threats identified"
            />
          </div>
        </CardContent>
      </Card>

      {/* TOWS Matrix / Strategic Options */}
      {hasStrategicOptions && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-600" />
              <div>
                <CardTitle>Strategic Options (TOWS Matrix)</CardTitle>
                <CardDescription>
                  Cross-referencing SWOT factors to identify strategic directions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StrategySection
                title="SO Strategies (Strength-Opportunity)"
                strategies={strategicOptions.soStrategies}
                colorClass="bg-emerald-50 border-emerald-200"
              />
              <StrategySection
                title="WO Strategies (Weakness-Opportunity)"
                strategies={strategicOptions.woStrategies}
                colorClass="bg-sky-50 border-sky-200"
              />
              <StrategySection
                title="ST Strategies (Strength-Threat)"
                strategies={strategicOptions.stStrategies}
                colorClass="bg-violet-50 border-violet-200"
              />
              <StrategySection
                title="WT Strategies (Weakness-Threat)"
                strategies={strategicOptions.wtStrategies}
                colorClass="bg-rose-50 border-rose-200"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority Actions */}
      {priorityActions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle>Priority Actions</CardTitle>
                <CardDescription>
                  Recommended immediate actions based on the analysis
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {priorityActions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-semibold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm pt-0.5">{action}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Continue Button */}
      {onContinue && (
        <div className="flex justify-end">
          <Button onClick={onContinue} className="gap-2">
            Continue to Strategic Decisions
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
