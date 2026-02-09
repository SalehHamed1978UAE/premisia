import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, 
  Target, 
  Lightbulb, 
  TrendingUp, 
  CheckCircle2,
  AlertCircle,
  Network,
  LayoutGrid
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type FrameworkType = 'business_model_canvas' | 'porters_five_forces' | 'user_choice';

export interface FrameworkSignals {
  bmcKeywords: string[];
  portersKeywords: string[];
  businessStage: string;
  queryType: string;
}

export interface FrameworkSelectionData {
  selectedFramework: FrameworkType;
  confidence: number;
  signals: FrameworkSignals;
  reasoning: string;
  alternativeFramework?: FrameworkType;
}

interface FrameworkSelectionProps {
  selection: FrameworkSelectionData;
  onConfirm: () => void;
  onOverride: (framework: FrameworkType) => void;
  isLoading?: boolean;
}

const FRAMEWORK_INFO = {
  business_model_canvas: {
    name: "Business Model Canvas",
    description: "Design and validate your business model, revenue streams, and customer value",
    icon: LayoutGrid,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  porters_five_forces: {
    name: "Porter's Five Forces",
    description: "Analyze competitive dynamics and industry structure",
    icon: Network,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  user_choice: {
    name: "Manual Selection",
    description: "Choose your preferred framework manually",
    icon: Target,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950",
    borderColor: "border-gray-200 dark:border-gray-800",
  },
};

export function FrameworkSelection({ 
  selection, 
  onConfirm, 
  onOverride,
  isLoading = false 
}: FrameworkSelectionProps) {
  const { selectedFramework, confidence, signals, reasoning, alternativeFramework } = selection;
  
  const selectedInfo = FRAMEWORK_INFO[selectedFramework as keyof typeof FRAMEWORK_INFO] || FRAMEWORK_INFO.user_choice;
  const alternativeInfo = alternativeFramework ? (FRAMEWORK_INFO[alternativeFramework as keyof typeof FRAMEWORK_INFO] || null) : null;

  const confidencePercent = Math.round(confidence * 100);
  const confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'moderate' : 'low';

  const SelectedIcon = selectedInfo?.icon || Target;

  return (
    <div className="space-y-6" data-testid="framework-selection-container">
      <Card className={`border-2 ${selectedInfo.borderColor}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${selectedInfo.bgColor}`}>
                <SelectedIcon className={`h-6 w-6 ${selectedInfo.color}`} />
              </div>
              <div>
                <CardTitle className="text-xl" data-testid="selected-framework-name">
                  {selectedInfo.name}
                </CardTitle>
                <CardDescription data-testid="selected-framework-description">
                  {selectedInfo.description}
                </CardDescription>
              </div>
            </div>
            <Badge 
              variant={confidenceLevel === 'high' ? 'default' : confidenceLevel === 'moderate' ? 'secondary' : 'outline'}
              data-testid="confidence-badge"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {confidencePercent}% Confidence
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Confidence Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">AI Confidence</span>
              <span className="font-medium" data-testid="confidence-percent">{confidencePercent}%</span>
            </div>
            <Progress 
              value={confidencePercent} 
              className="h-2"
              data-testid="confidence-progress"
            />
          </div>

          {/* AI Reasoning */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Why this framework?</span>
            </div>
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription data-testid="framework-reasoning">
                {reasoning}
              </AlertDescription>
            </Alert>
          </div>

          {/* Detected Signals */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Detected Signals</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {signals.bmcKeywords.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Business Model Keywords</p>
                  <div className="flex flex-wrap gap-1" data-testid="bmc-keywords">
                    {signals.bmcKeywords.slice(0, 5).map((keyword, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {signals.bmcKeywords.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{signals.bmcKeywords.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {signals.portersKeywords.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Competitive Keywords</p>
                  <div className="flex flex-wrap gap-1" data-testid="porters-keywords">
                    {signals.portersKeywords.slice(0, 5).map((keyword, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {signals.portersKeywords.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{signals.portersKeywords.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {signals.businessStage !== 'unknown' && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Business Stage</p>
                  <Badge variant="secondary" data-testid="business-stage">
                    {signals.businessStage.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}
              {signals.queryType !== 'general' && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Query Type</p>
                  <Badge variant="secondary" data-testid="query-type">
                    {signals.queryType.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Alternative Framework */}
          {alternativeInfo && confidenceLevel !== 'high' && (
            <Alert variant="default" className="border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription>
                <span className="font-medium">Alternative framework available: </span>
                {alternativeInfo.name} could also be relevant to your analysis.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              onClick={onConfirm} 
              disabled={isLoading}
              className="flex-1"
              data-testid="button-confirm-framework"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Continue with {selectedInfo.name}
            </Button>
            {alternativeInfo && (
              <Button 
                onClick={() => onOverride(alternativeFramework!)} 
                variant="outline"
                disabled={isLoading}
                className="flex-1"
                data-testid="button-override-framework"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Use {alternativeInfo.name} Instead
              </Button>
            )}
          </div>

          {confidenceLevel === 'low' && (
            <p className="text-xs text-muted-foreground text-center">
              Low confidence detected. You can manually choose the framework that best fits your needs.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
