import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
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
}

const getLevelColor = (level: string) => {
  switch (level?.toLowerCase()) {
    case 'high': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    default: return 'outline';
  }
};

export default function AnalysisPage() {
  const [, params] = useRoute("/strategic-consultant/analysis/:sessionId");
  const [, setLocation] = useLocation();
  const sessionId = params?.sessionId;

  const { data, isLoading, error } = useQuery<{ analysis: AnalysisData; versionNumber: number }>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, 1],
    enabled: !!sessionId,
  });

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
          <p className="text-muted-foreground">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
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

  const analysis = data.analysis;
  const hasFiveWhys = !!analysis.five_whys;
  const hasPorters = !!analysis.porters_five_forces;

  return (
    <AppLayout
      title="Strategic Analysis"
      subtitle="AI-powered strategic insights and recommendations"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground" data-testid="text-session-id">Session: {sessionId}</p>
          </div>
          <Button
            onClick={() => setLocation(`/strategic-consultant/decisions/${sessionId}/${data.versionNumber}`)}
            data-testid="button-proceed-decisions"
          >
            Proceed to Decisions <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

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
              {[
                { key: 'competitive_rivalry', label: 'Competitive Rivalry' },
                { key: 'supplier_power', label: 'Supplier Power' },
                { key: 'buyer_power', label: 'Buyer Power' },
                { key: 'threat_of_substitution', label: 'Threat of Substitution' },
                { key: 'threat_of_new_entry', label: 'Threat of New Entry' }
              ].map(({ key, label }) => {
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

        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={() => setLocation(`/strategic-consultant/decisions/${sessionId}/${data.versionNumber}`)}
            data-testid="button-proceed-decisions-bottom"
          >
            Proceed to Strategic Decisions <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
