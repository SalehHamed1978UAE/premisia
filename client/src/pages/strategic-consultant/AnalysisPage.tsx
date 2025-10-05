import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ArrowRight, AlertCircle, ExternalLink, ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";

interface FiveWhys {
  problem_statement: string;
  why_1: { question: string; answer: string };
  why_2: { question: string; answer: string };
  why_3: { question: string; answer: string };
  why_4: { question: string; answer: string };
  why_5: { question: string; answer: string };
  root_cause: string;
  strategic_implications: string[];
}

interface PortersFiveForces {
  competitive_rivalry: { level: string; factors: string[]; strategic_response: string };
  supplier_power: { level: string; factors: string[]; strategic_response: string };
  buyer_power: { level: string; factors: string[]; strategic_response: string };
  threat_of_substitution: { level: string; factors: string[]; strategic_response: string };
  threat_of_new_entry: { level: string; factors: string[]; strategic_response: string };
  overall_attractiveness: string;
  key_strategic_priorities: string[];
}

interface AnalysisData {
  five_whys?: FiveWhys;
  porters_five_forces?: PortersFiveForces;
  recommended_approaches: string[];
  recommended_market: string;
  executive_summary: string;
  research?: any;
  enhanced_analysis?: EnhancedAnalysisResult;
}

interface PorterForceWithCitations {
  level: 'low' | 'medium' | 'high';
  factors: Array<{
    factor: string;
    citations: string[];
  }>;
  strategic_response: string;
  confidence: 'high' | 'medium' | 'low';
  insufficientData?: boolean;
}

interface PortersWithCitations {
  competitive_rivalry: PorterForceWithCitations;
  supplier_power: PorterForceWithCitations;
  buyer_power: PorterForceWithCitations;
  threat_of_substitution: PorterForceWithCitations;
  threat_of_new_entry: PorterForceWithCitations;
  overall_attractiveness: 'low' | 'medium' | 'high';
}

interface Recommendation {
  text: string;
  rationale: string;
  citations: string[];
}

interface Source {
  url: string;
  title: string;
  relevance_score: number;
}

interface EnhancedAnalysisResult {
  executiveSummary: string;
  portersAnalysis: PortersWithCitations;
  recommendations: Recommendation[];
  researchBased: true;
  confidenceScore: number;
  citations: Source[];
}

const getLevelColor = (level: string) => {
  switch (level?.toLowerCase()) {
    case 'high': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    default: return 'outline';
  }
};

const getConfidenceColor = (confidence: string) => {
  switch (confidence?.toLowerCase()) {
    case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'low': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

export default function AnalysisPage() {
  const [, params] = useRoute("/strategic-consultant/analysis/:sessionId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [enhancedAnalysis, setEnhancedAnalysis] = useState<EnhancedAnalysisResult | null>(null);

  const { data, isLoading, error } = useQuery<{ version: { analysis: AnalysisData; versionNumber: number } }>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, 1],
    enabled: !!sessionId,
  });

  const enhancedAnalysisMutation = useMutation({
    mutationFn: async () => {
      const rootCause = localStorage.getItem(`strategic-rootCause-${sessionId}`) || '';
      const whysPathStr = localStorage.getItem(`strategic-whysPath-${sessionId}`) || '[]';
      const whysPath = JSON.parse(whysPathStr);

      if (!rootCause || !whysPath.length) {
        throw new Error('Missing root cause or whys path');
      }

      const response = await apiRequest('POST', '/api/strategic-consultant/analyze-enhanced', {
        sessionId,
        rootCause,
        whysPath,
        versionNumber: data?.version.versionNumber,
      });
      return await response.json();
    },
    onSuccess: (result) => {
      setEnhancedAnalysis(result.analysis);
      toast({
        title: "Research-backed analysis complete",
        description: `Confidence score: ${result.analysis.confidenceScore}%`,
      });
    },
    onError: (error) => {
      console.error('Enhanced analysis failed:', error);
      toast({
        title: "Enhanced analysis failed",
        description: "Falling back to standard analysis",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (data?.version?.analysis?.research && !data.version.analysis.enhanced_analysis && !enhancedAnalysis) {
      enhancedAnalysisMutation.mutate();
    } else if (data?.version?.analysis?.enhanced_analysis) {
      setEnhancedAnalysis(data.version.analysis.enhanced_analysis);
    }
  }, [data]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
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

  if (isLoading || enhancedAnalysisMutation.isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {enhancedAnalysisMutation.isPending ? 'Generating research-backed analysis...' : 'Loading analysis...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !data || !data.version || !data.version.analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analysis Not Found</AlertTitle>
          <AlertDescription>
            {error?.message || "Unable to load analysis. The session may not exist or analysis may have failed."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const analysis = data.version.analysis;
  const hasEnhancedAnalysis = !!enhancedAnalysis;
  const hasFiveWhys = !!analysis?.five_whys;
  const hasPorters = !!analysis?.porters_five_forces;

  const forceCategories = [
    { key: 'competitive_rivalry', label: 'Competitive Rivalry' },
    { key: 'supplier_power', label: 'Supplier Power' },
    { key: 'buyer_power', label: 'Buyer Power' },
    { key: 'threat_of_substitution', label: 'Threat of Substitution' },
    { key: 'threat_of_new_entry', label: 'Threat of New Entry' }
  ];

  return (
    <AppLayout
      title="Strategic Analysis"
      subtitle={hasEnhancedAnalysis ? "Research-backed AI strategic insights" : "AI-powered strategic insights and recommendations"}
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground" data-testid="text-session-id">Session: {sessionId}</p>
            {hasEnhancedAnalysis && (
              <Badge variant="default" className="bg-blue-600" data-testid="badge-research-backed">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Research-backed Analysis
              </Badge>
            )}
          </div>
          <Button
            onClick={() => setLocation(`/strategic-consultant/decisions/${sessionId}/${data.version.versionNumber}`)}
            data-testid="button-proceed-decisions"
          >
            Proceed to Decisions <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {hasEnhancedAnalysis && enhancedAnalysis && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Executive Summary</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Overall Confidence:</span>
                    <Badge className={getConfidenceColor(
                      enhancedAnalysis.confidenceScore >= 75 ? 'high' : 
                      enhancedAnalysis.confidenceScore >= 50 ? 'medium' : 'low'
                    )} data-testid="badge-confidence-overall">
                      {enhancedAnalysis.confidenceScore}%
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-4" data-testid="text-executive-summary">{enhancedAnalysis.executiveSummary}</p>
                <div className="mt-2">
                  <Progress value={enhancedAnalysis.confidenceScore} className="h-2" data-testid="progress-confidence" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Porter's Five Forces Analysis (Research-backed)</CardTitle>
                <CardDescription>
                  Overall Market Attractiveness: <Badge variant={getLevelColor(enhancedAnalysis.portersAnalysis.overall_attractiveness)} data-testid="badge-overall-attractiveness">
                    {enhancedAnalysis.portersAnalysis.overall_attractiveness}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {forceCategories.map(({ key, label }) => {
                  const force = enhancedAnalysis.portersAnalysis[key as keyof PortersWithCitations] as PorterForceWithCitations;
                  return (
                    <div key={key} className="space-y-3 border-l-4 border-primary/20 pl-4" data-testid={`section-porter-${key}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-lg">{label}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={getLevelColor(force.level)} data-testid={`badge-level-${key}`}>{force.level}</Badge>
                          <Badge className={getConfidenceColor(force.confidence)} data-testid={`badge-confidence-${key}`}>
                            {force.confidence} confidence
                          </Badge>
                        </div>
                      </div>

                      {force.insufficientData && (
                        <Alert variant="default" className="border-yellow-500" data-testid={`alert-insufficient-${key}`}>
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <AlertTitle>Insufficient Data</AlertTitle>
                          <AlertDescription>
                            Limited research data available for this force. Analysis may be less comprehensive.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Key Factors:</p>
                        <ul className="space-y-2">
                          {force.factors.map((factorObj, idx) => (
                            <li key={idx} className="text-sm">
                              <div className="flex items-start gap-2">
                                <span className="flex-1">{factorObj.factor}</span>
                                <div className="flex gap-1">
                                  {factorObj.citations.map((citation, citIdx) => (
                                    <a
                                      key={citIdx}
                                      href={citation}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                      data-testid={`link-citation-${key}-${idx}-${citIdx}`}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-secondary/50 p-3 rounded-md">
                        <p className="text-sm">
                          <span className="font-medium">Strategic Response: </span>
                          {force.strategic_response}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Strategic Recommendations</CardTitle>
                <CardDescription>Research-grounded actionable recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {enhancedAnalysis.recommendations.map((rec, idx) => (
                    <div key={idx} className="border rounded-lg p-4" data-testid={`recommendation-${idx}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold mb-2">{rec.text}</h4>
                          <p className="text-sm text-muted-foreground mb-2">{rec.rationale}</p>
                        </div>
                        <div className="flex gap-1">
                          {rec.citations.map((citation, citIdx) => (
                            <a
                              key={citIdx}
                              href={citation}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              data-testid={`link-recommendation-citation-${idx}-${citIdx}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <Collapsible open={openSections['sources']} onOpenChange={() => toggleSection('sources')}>
                <CardHeader>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between" data-testid="toggle-sources">
                      <CardTitle>Research Sources ({enhancedAnalysis.citations.length})</CardTitle>
                      <ChevronDown className={`h-5 w-5 transition-transform ${openSections['sources'] ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-3">
                      {enhancedAnalysis.citations.map((source, idx) => (
                        <div key={idx} className="flex items-start justify-between border-b pb-3 last:border-b-0" data-testid={`source-${idx}`}>
                          <div className="flex-1">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-2"
                            >
                              {source.title}
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <p className="text-xs text-muted-foreground mt-1">{source.url}</p>
                          </div>
                          {source.relevance_score && (
                            <Badge variant="outline" className="ml-2" data-testid={`badge-relevance-${idx}`}>
                              Relevance: {(source.relevance_score * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </>
        )}

        {!hasEnhancedAnalysis && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg" data-testid="text-executive-summary">{analysis.executive_summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Recommended Approach:</span>
                    {analysis.recommended_approaches.map((approach) => (
                      <Badge key={approach} variant="default" data-testid={`badge-approach-${approach}`}>
                        {approach.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Target Market:</span>
                    <Badge variant="secondary" data-testid="badge-market">
                      {analysis.recommended_market.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {hasFiveWhys && (
              <Card>
                <CardHeader>
                  <CardTitle>5 Whys Root Cause Analysis</CardTitle>
                  <CardDescription>{analysis.five_whys!.problem_statement}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[1, 2, 3, 4, 5].map((num) => {
                    const why = analysis.five_whys![`why_${num}` as keyof FiveWhys] as { question: string; answer: string };
                    return (
                      <div key={num} className="border-l-4 border-primary/20 pl-4" data-testid={`section-why-${num}`}>
                        <p className="font-medium text-sm text-muted-foreground">{why.question}</p>
                        <p className="mt-1">{why.answer}</p>
                      </div>
                    );
                  })}
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Root Cause</h4>
                    <p className="text-lg" data-testid="text-root-cause">{analysis.five_whys!.root_cause}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Strategic Implications</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.five_whys!.strategic_implications.map((implication, idx) => (
                        <li key={idx} className="text-muted-foreground" data-testid={`text-implication-${idx}`}>
                          {implication}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {hasPorters && (
              <Card>
                <CardHeader>
                  <CardTitle>Porter's Five Forces Analysis</CardTitle>
                  <CardDescription>
                    Overall Market Attractiveness: <Badge variant={getLevelColor(analysis.porters_five_forces!.overall_attractiveness)}>
                      {analysis.porters_five_forces!.overall_attractiveness}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {forceCategories.map(({ key, label }) => {
                    const force = analysis.porters_five_forces![key as keyof PortersFiveForces] as any;
                    return (
                      <div key={key} className="space-y-2" data-testid={`section-${key}`}>
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{label}</h4>
                          <Badge variant={getLevelColor(force.level)}>{force.level}</Badge>
                        </div>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {force.factors.map((factor: string, idx: number) => (
                            <li key={idx}>{factor}</li>
                          ))}
                        </ul>
                        <p className="text-sm bg-secondary/50 p-3 rounded-md">
                          <span className="font-medium">Response: </span>
                          {force.strategic_response}
                        </p>
                      </div>
                    );
                  })}

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Key Strategic Priorities</h4>
                    <ul className="list-decimal list-inside space-y-1">
                      {analysis.porters_five_forces!.key_strategic_priorities.map((priority, idx) => (
                        <li key={idx} className="text-muted-foreground" data-testid={`text-priority-${idx}`}>
                          {priority}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {!hasFiveWhys && !hasPorters && (
              <Card>
                <CardHeader>
                  <CardTitle>Strategic Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Analysis focused on strategic recommendations. Detailed frameworks available upon request.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={() => setLocation(`/strategic-consultant/decisions/${sessionId}/${data.version.versionNumber}`)}
            data-testid="button-proceed-decisions-bottom"
          >
            Proceed to Strategic Decisions <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
