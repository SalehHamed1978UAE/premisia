import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { AssumptionComparison } from "@/types/trend-analysis";

interface AssumptionComparisonViewProps {
  comparisons: AssumptionComparison[];
}

const RELATIONSHIP_CONFIG = {
  validates: {
    label: 'Validates',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    badgeVariant: 'default' as const,
  },
  contradicts: {
    label: 'Contradicts',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    badgeVariant: 'destructive' as const,
  },
  partially_validates: {
    label: 'Partially Validates',
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    badgeVariant: 'secondary' as const,
  },
};

export function AssumptionComparisonView({ comparisons }: AssumptionComparisonViewProps) {
  const validations = comparisons.filter(c => c.relationship === 'validates');
  const contradictions = comparisons.filter(c => c.relationship === 'contradicts');
  const partialValidations = comparisons.filter(c => c.relationship === 'partially_validates');

  return (
    <Card data-testid="card-assumption-comparison">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">Assumption Analysis</CardTitle>
          <div className="flex gap-2">
            <Badge variant="default" data-testid="badge-validations-count">
              {validations.length} Validated
            </Badge>
            {contradictions.length > 0 && (
              <Badge variant="destructive" data-testid="badge-contradictions-count">
                {contradictions.length} Contradicted
              </Badge>
            )}
            {partialValidations.length > 0 && (
              <Badge variant="secondary" data-testid="badge-partial-count">
                {partialValidations.length} Partial
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {comparisons.length === 0 ? (
          <Alert>
            <AlertDescription>No assumptions available for comparison</AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Contradictions - Most Important */}
            {contradictions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                  Contradicted Assumptions
                </h3>
                {contradictions.map((comparison, index) => {
                  const config = RELATIONSHIP_CONFIG[comparison.relationship];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={comparison.assumptionId}
                      className={`border-2 rounded-lg p-4 space-y-3 ${config.bgColor}`}
                      data-testid={`comparison-${comparison.relationship}-${index}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                        <div className="flex-1 space-y-2">
                          <p className="font-medium" data-testid={`assumption-claim-${index}`}>
                            {comparison.assumptionClaim}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`comparison-evidence-${index}`}>
                            {comparison.evidence}
                          </p>
                          {comparison.explanation && (
                            <p className="text-sm italic" data-testid={`comparison-explanation-${index}`}>
                              {comparison.explanation}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant={comparison.confidence === 'high' ? 'default' : 'secondary'}>
                              {comparison.confidence} confidence
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Partial Validations */}
            {partialValidations.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  Partially Validated Assumptions
                </h3>
                {partialValidations.map((comparison, index) => {
                  const config = RELATIONSHIP_CONFIG[comparison.relationship];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={comparison.assumptionId}
                      className={`border-2 rounded-lg p-4 space-y-3 ${config.bgColor}`}
                      data-testid={`comparison-${comparison.relationship}-${index}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                        <div className="flex-1 space-y-2">
                          <p className="font-medium">{comparison.assumptionClaim}</p>
                          <p className="text-sm text-muted-foreground">{comparison.evidence}</p>
                          {comparison.explanation && (
                            <p className="text-sm italic">{comparison.explanation}</p>
                          )}
                          <Badge variant={comparison.confidence === 'high' ? 'default' : 'secondary'}>
                            {comparison.confidence} confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Validations */}
            {validations.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Validated Assumptions
                </h3>
                {validations.map((comparison, index) => {
                  const config = RELATIONSHIP_CONFIG[comparison.relationship];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={comparison.assumptionId}
                      className={`border-2 rounded-lg p-4 space-y-3 ${config.bgColor}`}
                      data-testid={`comparison-${comparison.relationship}-${index}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                        <div className="flex-1 space-y-2">
                          <p className="font-medium">{comparison.assumptionClaim}</p>
                          <p className="text-sm text-muted-foreground">{comparison.evidence}</p>
                          {comparison.explanation && (
                            <p className="text-sm italic">{comparison.explanation}</p>
                          )}
                          <Badge variant={comparison.confidence === 'high' ? 'default' : 'secondary'}>
                            {comparison.confidence} confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
