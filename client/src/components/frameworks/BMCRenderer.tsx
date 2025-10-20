import type { FC } from 'react';
import type { BMCFrameworkResult } from '@shared/framework-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { FrameworkRendererProps } from './index';

const BMCRenderer: FC<FrameworkRendererProps<BMCFrameworkResult>> = ({ data }) => {
  return (
    <div className="space-y-6" data-testid="framework-bmc">
      {/* Overall Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Overall Assessment</CardTitle>
            <Badge variant={data.overallConfidence > 0.7 ? "default" : "secondary"} data-testid="badge-confidence">
              {Math.round(data.overallConfidence * 100)}% Confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Viability</h3>
            <p className="text-sm text-muted-foreground" data-testid="text-viability">{data.viability}</p>
          </div>

          {Array.isArray(data.contradictions) && data.contradictions.length > 0 && (
            <Alert variant="destructive" data-testid="alert-contradictions">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Contradictions Detected</AlertTitle>
              <AlertDescription>
                {data.contradictions.length} contradiction(s) found between assumptions and research
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Key Insights */}
      {Array.isArray(data.keyInsights) && data.keyInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2" data-testid="list-key-insights">
              {data.keyInsights.map((insight, idx) => (
                <li key={idx} className="text-sm">{insight}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {Array.isArray(data.recommendations) && data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Strategic Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2" data-testid="list-recommendations">
              {data.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm">{rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* BMC Blocks */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Canvas Components</h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          {data.blocks.map((block, idx) => (
            <Card key={idx} data-testid={`card-bmc-block-${idx}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{block.blockName}</CardTitle>
                  <Badge variant="outline">
                    {Math.round(block.confidence * 100)}%
                  </Badge>
                </div>
                <CardDescription className="mt-2">{block.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.isArray(block.keyFindings) && block.keyFindings.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Key Findings</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {block.keyFindings.map((finding, fidx) => (
                        <li key={fidx} className="text-sm text-muted-foreground">{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(block.strategicImplications) && block.strategicImplications.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Strategic Implications</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {block.strategicImplications.map((impl, iidx) => (
                        <li key={iidx} className="text-sm text-muted-foreground">{impl}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(block.identifiedGaps) && block.identifiedGaps.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-amber-600">Identified Gaps</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {block.identifiedGaps.map((gap, gidx) => (
                        <li key={gidx} className="text-sm text-amber-600">{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Critical Gaps */}
      {Array.isArray(data.criticalGaps) && data.criticalGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-600">Critical Gaps to Address</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2" data-testid="list-critical-gaps">
              {data.criticalGaps.map((gap, idx) => (
                <li key={idx} className="text-sm text-amber-600">{gap}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BMCRenderer;
