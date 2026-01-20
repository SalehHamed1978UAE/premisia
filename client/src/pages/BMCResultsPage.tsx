import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, Download, FileJson, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface StrategicImplication {
  priority?: string;
  action: string;
  rationale?: string;
}

type ImplicationItem = string | StrategicImplication;

interface BMCBlock {
  blockName: string;
  description: string;
  keyFindings: (string | { action?: string; rationale?: string })[];
  confidence: number;
  strategicImplications: ImplicationItem[];
  identifiedGaps: (string | { action?: string; rationale?: string })[];
  researchQueries: string[];
}

type FlexibleItem = string | { priority?: string; action?: string; rationale?: string; [key: string]: any };

interface BMCResult {
  blocks: BMCBlock[];
  overallConfidence: number;
  viability: string;
  keyInsights: FlexibleItem[];
  criticalGaps: FlexibleItem[];
  consistencyChecks: FlexibleItem[];
  recommendations: FlexibleItem[];
  contradictions?: any[];
}

interface Version {
  versionNumber: number;
  status: string;
  createdAt: string;
  finalizedAt?: string;
  analysis?: {
    bmc_research?: BMCResult;
  };
  decisions?: any;
  selectedDecisions?: any;
  program?: any;
}

export default function BMCResultsPage() {
  const [, params] = useRoute("/bmc/results/:sessionId/:versionNumber");
  const { toast } = useToast();
  
  const sessionId = params?.sessionId || '';
  const versionNumber = params?.versionNumber ? parseInt(params.versionNumber) : 1;

  const { data: response, isLoading, error } = useQuery<{ success: boolean; version: Version }>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber],
    enabled: !!sessionId,
  });

  const versionData = response?.version;
  const bmcResult = versionData?.analysis?.bmc_research;

  const handleDownloadJSON = () => {
    if (!bmcResult) return;

    const dataStr = JSON.stringify(bmcResult, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bmc-analysis-${sessionId}-v${versionNumber}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "BMC analysis exported as JSON",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading BMC analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !response) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Results</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load BMC analysis'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!bmcResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No BMC Analysis Found</AlertTitle>
          <AlertDescription>
            This version does not contain BMC research results yet.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">
                Business Model Canvas Analysis
              </h1>
              <p className="text-muted-foreground">
                Session: {sessionId} • Version {versionNumber}
              </p>
            </div>
            <Button
              onClick={handleDownloadJSON}
              data-testid="button-download-json"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download JSON
            </Button>
          </div>

          {/* Overall Metrics */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Overall Assessment</CardTitle>
                <Badge variant={bmcResult.overallConfidence > 0.7 ? "default" : "secondary"}>
                  {Math.round(bmcResult.overallConfidence * 100)}% Confidence
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Viability</h3>
                <p className="text-sm text-muted-foreground">{bmcResult.viability}</p>
              </div>

              {bmcResult.contradictions && bmcResult.contradictions.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Contradictions Detected</AlertTitle>
                  <AlertDescription>
                    {bmcResult.contradictions.length} contradiction(s) found between assumptions and research
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Key Insights */}
        {Array.isArray(bmcResult.keyInsights) && bmcResult.keyInsights.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2">
                {bmcResult.keyInsights.map((insight, idx) => (
                  <li key={idx} className="text-sm">
                    {typeof insight === 'string' ? insight : (insight?.action || insight?.rationale || JSON.stringify(insight))}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {Array.isArray(bmcResult.recommendations) && bmcResult.recommendations.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Strategic Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2">
                {bmcResult.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm">
                    {typeof rec === 'string' ? rec : (
                      rec?.action ? (
                        <span>
                          {rec.priority && <Badge variant="outline" className="mr-2 text-xs">{rec.priority}</Badge>}
                          <span className="font-medium">{rec.action}</span>
                          {rec.rationale && <span className="text-muted-foreground ml-1">— {rec.rationale}</span>}
                        </span>
                      ) : JSON.stringify(rec)
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* BMC Blocks */}
        <div className="space-y-6">
          <h2 className="text-xl md:text-2xl font-bold">Canvas Components</h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            {bmcResult.blocks.map((block, idx) => (
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
                          <li key={fidx} className="text-sm text-muted-foreground">
                            {typeof finding === 'string' ? finding : (finding?.action || finding?.rationale || JSON.stringify(finding))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(block.strategicImplications) && block.strategicImplications.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Strategic Implications</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {block.strategicImplications.map((impl, iidx) => (
                          <li key={iidx} className="text-sm text-muted-foreground">
                            {typeof impl === 'string' ? impl : (
                              impl?.action ? (
                                <span>
                                  <span className="font-medium">{impl.action}</span>
                                  {impl.rationale && <span className="text-xs text-muted-foreground/70 ml-1">— {impl.rationale}</span>}
                                </span>
                              ) : JSON.stringify(impl)
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(block.identifiedGaps) && block.identifiedGaps.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-amber-600">Identified Gaps</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {block.identifiedGaps.map((gap, gidx) => (
                          <li key={gidx} className="text-sm text-amber-600">
                            {typeof gap === 'string' ? gap : (gap?.action || gap?.rationale || JSON.stringify(gap))}
                          </li>
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
        {Array.isArray(bmcResult.criticalGaps) && bmcResult.criticalGaps.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-amber-600">Critical Gaps to Address</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2">
                {bmcResult.criticalGaps.map((gap, idx) => (
                  <li key={idx} className="text-sm text-amber-600">
                    {typeof gap === 'string' ? gap : (gap?.action || gap?.rationale || JSON.stringify(gap))}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
