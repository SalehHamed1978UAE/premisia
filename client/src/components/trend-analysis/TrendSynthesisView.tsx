import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Target, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TrendSynthesis, TrendTelemetry } from "@/types/trend-analysis";

interface TrendSynthesisViewProps {
  synthesis: TrendSynthesis;
  telemetry?: TrendTelemetry;
}

export function TrendSynthesisView({ synthesis, telemetry }: TrendSynthesisViewProps) {
  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <Card data-testid="card-executive-summary">
        <CardHeader>
          <CardTitle className="text-2xl">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed" data-testid="text-executive-summary">
            {synthesis.executiveSummary}
          </p>
        </CardContent>
      </Card>

      {/* Key Findings */}
      {synthesis.keyFindings && synthesis.keyFindings.length > 0 && (
        <Card data-testid="card-key-findings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Key Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {synthesis.keyFindings.map((finding, index) => (
                <li key={index} className="flex gap-2" data-testid={`finding-${index}`}>
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Strategic Implications */}
      {synthesis.strategicImplications && synthesis.strategicImplications.length > 0 && (
        <Card data-testid="card-strategic-implications">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Strategic Implications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {synthesis.strategicImplications.map((implication, index) => (
                <li key={index} className="flex gap-2" data-testid={`implication-${index}`}>
                  <span className="text-primary font-semibold">→</span>
                  <span>{implication}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Opportunities */}
        {synthesis.opportunities && synthesis.opportunities.length > 0 && (
          <Card data-testid="card-opportunities">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <TrendingUp className="h-5 w-5" />
                Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {synthesis.opportunities.map((opportunity, index) => (
                  <li key={index} className="text-sm" data-testid={`opportunity-${index}`}>
                    • {opportunity}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Risks */}
        {synthesis.risks && synthesis.risks.length > 0 && (
          <Card data-testid="card-risks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Risks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {synthesis.risks.map((risk, index) => (
                  <li key={index} className="text-sm" data-testid={`risk-${index}`}>
                    • {risk}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommended Actions */}
      {synthesis.recommendedActions && synthesis.recommendedActions.length > 0 && (
        <Card data-testid="card-recommended-actions">
          <CardHeader>
            <CardTitle>Recommended Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {synthesis.recommendedActions.map((action, index) => (
                <li key={index} className="flex gap-3" data-testid={`action-${index}`}>
                  <Badge variant="outline" className="flex-shrink-0">
                    {index + 1}
                  </Badge>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Telemetry (Optional) */}
      {telemetry && (
        <Card className="border-dashed" data-testid="card-telemetry">
          <CardHeader>
            <CardTitle className="text-sm">Analysis Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Processing Time</p>
                <p className="font-semibold">{(telemetry.totalLatencyMs / 1000).toFixed(1)}s</p>
              </div>
              <div>
                <p className="text-muted-foreground">LLM Calls</p>
                <p className="font-semibold">{telemetry.llmCalls}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cache Hits</p>
                <p className="font-semibold">{telemetry.cacheHits}</p>
              </div>
              <div>
                <p className="text-muted-foreground">API Calls</p>
                <p className="font-semibold">{telemetry.apiCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
