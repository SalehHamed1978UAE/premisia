import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, ArrowRight, GitCompare } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLayout } from "@/components/layout/AppLayout";

interface Version {
  versionNumber: number;
  status: string;
  createdAt: string;
  finalizedAt?: string;
  selectedDecisions?: Record<string, string>;
  analysis?: {
    recommended_approaches: string[];
    recommended_market: string;
  };
}

interface ComparisonData {
  version1: Version & { analysis: any; decisions: any[] };
  version2: Version & { analysis: any; decisions: any[] };
  differences: {
    approach_changed: boolean;
    market_changed: boolean;
    decisions_changed: string[];
  };
}

export default function VersionsPage() {
  const [, params] = useRoute("/strategic-consultant/versions/:sessionId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;

  const [compareVersion1, setCompareVersion1] = useState<number | null>(null);
  const [compareVersion2, setCompareVersion2] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const { data: versions, isLoading, error } = useQuery<Version[]>({
    queryKey: ['/api/strategic-consultant/versions', sessionId],
    enabled: !!sessionId,
  });

  const { data: comparison, isLoading: isComparing } = useQuery<ComparisonData>({
    queryKey: ['/api/strategic-consultant/versions/compare', sessionId, compareVersion1, compareVersion2],
    enabled: showComparison && !!sessionId && compareVersion1 !== null && compareVersion2 !== null,
    queryFn: async () => {
      const response = await fetch('/api/strategic-consultant/versions/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          version1: compareVersion1,
          version2: compareVersion2
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Comparison failed');
      }

      return response.json();
    }
  });

  const handleCompare = () => {
    if (compareVersion1 === null || compareVersion2 === null) {
      toast({
        title: "Select versions to compare",
        description: "Please select two different versions",
        variant: "destructive"
      });
      return;
    }

    if (compareVersion1 === compareVersion2) {
      toast({
        title: "Same version selected",
        description: "Please select two different versions to compare",
        variant: "destructive"
      });
      return;
    }

    setShowComparison(true);
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Session</AlertTitle>
          <AlertDescription>No session ID provided in URL</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading versions...</p>
        </div>
      </div>
    );
  }

  if (error || !versions) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Versions Not Found</AlertTitle>
          <AlertDescription>
            {error?.message || "Unable to load strategy versions."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <AppLayout
      title="Strategy Versions"
      subtitle="Manage and compare strategy versions"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <p className="text-sm text-muted-foreground" data-testid="text-session-id">Session: {sessionId}</p>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list">Version List</TabsTrigger>
            <TabsTrigger value="compare">Compare Versions</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {versions.map((version) => (
                <Card key={version.versionNumber} data-testid={`card-version-${version.versionNumber}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Version {version.versionNumber}
                          <Badge variant={version.status === 'finalized' ? 'default' : 'secondary'}>
                            {version.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Created: {new Date(version.createdAt).toLocaleString()}
                          {version.finalizedAt && ` • Finalized: ${new Date(version.finalizedAt).toLocaleString()}`}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setLocation(`/strategic-consultant/epm/${sessionId}/${version.versionNumber}`)}
                        data-testid={`button-view-version-${version.versionNumber}`}
                      >
                        View EPM <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  {version.analysis && (
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground">Strategic Approach:</span>
                        {version.analysis.recommended_approaches.map((approach) => (
                          <Badge key={approach} variant="outline">
                            {approach.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Target Market:</span>
                        <Badge variant="secondary">{version.analysis.recommended_market.toUpperCase()}</Badge>
                      </div>
                      {version.selectedDecisions && Object.keys(version.selectedDecisions).length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Decisions:</span>
                          <Badge variant="outline">{Object.keys(version.selectedDecisions).length} selected</Badge>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="compare" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Compare Strategy Versions</CardTitle>
                <CardDescription>Select two versions to see differences in approach, market, and decisions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Version 1</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={compareVersion1 ?? ''}
                      onChange={(e) => setCompareVersion1(e.target.value ? parseInt(e.target.value) : null)}
                      data-testid="select-version-1"
                    >
                      <option value="">Select version</option>
                      {versions.map((v) => (
                        <option key={v.versionNumber} value={v.versionNumber}>
                          Version {v.versionNumber} ({v.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Version 2</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={compareVersion2 ?? ''}
                      onChange={(e) => setCompareVersion2(e.target.value ? parseInt(e.target.value) : null)}
                      data-testid="select-version-2"
                    >
                      <option value="">Select version</option>
                      {versions.map((v) => (
                        <option key={v.versionNumber} value={v.versionNumber}>
                          Version {v.versionNumber} ({v.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  onClick={handleCompare}
                  disabled={compareVersion1 === null || compareVersion2 === null || isComparing}
                  className="w-full"
                  data-testid="button-compare"
                >
                  {isComparing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <GitCompare className="mr-2 h-4 w-4" />
                      Compare Versions
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {showComparison && comparison && (
              <Card data-testid="card-comparison-results">
                <CardHeader>
                  <CardTitle>Comparison Results</CardTitle>
                  <CardDescription>
                    Version {compareVersion1} vs Version {compareVersion2}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Strategic Approach</h4>
                    {comparison.differences.approach_changed ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Version {compareVersion1}</p>
                          <div className="flex flex-wrap gap-1">
                            {comparison.version1.analysis.recommended_approaches.map((a: string) => (
                              <Badge key={a} variant="outline">{a.replace('_', ' ')}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Version {compareVersion2}</p>
                          <div className="flex flex-wrap gap-1">
                            {comparison.version2.analysis.recommended_approaches.map((a: string) => (
                              <Badge key={a} variant="default">{a.replace('_', ' ')}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Badge variant="secondary">No change</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Target Market</h4>
                    {comparison.differences.market_changed ? (
                      <div className="flex gap-4">
                        <Badge variant="outline">
                          V{compareVersion1}: {comparison.version1.analysis.recommended_market.toUpperCase()}
                        </Badge>
                        <Badge variant="default">
                          V{compareVersion2}: {comparison.version2.analysis.recommended_market.toUpperCase()}
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="secondary">No change</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Strategic Decisions</h4>
                    {comparison.differences.decisions_changed.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {comparison.differences.decisions_changed.length} decision(s) changed
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Decision</TableHead>
                              <TableHead>Version {compareVersion1}</TableHead>
                              <TableHead>Version {compareVersion2}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comparison.differences.decisions_changed.map((decisionId) => {
                              const decision1 = comparison.version1.decisions.find((d: any) => d.id === decisionId);
                              const decision2 = comparison.version2.decisions.find((d: any) => d.id === decisionId);
                              return (
                                <TableRow key={decisionId}>
                                  <TableCell className="font-medium">{decision1?.question || decisionId}</TableCell>
                                  <TableCell>
                                    {decision1?.options.find((o: any) => o.id === comparison.version1.selectedDecisions?.[decisionId])?.label || 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {decision2?.options.find((o: any) => o.id === comparison.version2.selectedDecisions?.[decisionId])?.label || 'N/A'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <Badge variant="secondary">No changes in decisions</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
