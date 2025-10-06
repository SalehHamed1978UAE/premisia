import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle, CheckCircle2, Users, DollarSign, Clock, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";

interface EPMProgram {
  title: string;
  strategic_approach: string;
  market_context: string;
  timeline: { total_months: number };
  cost_estimate: { total_min: number; total_max: number };
  workstreams: any[];
  stage_gates: any[];
  kpis: any[];
  benefits: any[];
  risks: any[];
  funding: { sources: any[] };
  resources: any[];
}

interface EPMData {
  version: {
    program: EPMProgram | null;
    versionNumber: number;
    status: string;
    finalizedAt?: string;
  };
  validation?: {
    structure: { valid: boolean };
    ontology: {
      valid: boolean;
      completeness: {
        score: number;
        maxScore: number;
        critical: { passed: number; total: number };
        important: { passed: number; total: number };
        missingFields: any[];
      };
    };
  };
  program?: EPMProgram;
}

export default function EPMPage() {
  const [, params] = useRoute("/strategic-consultant/epm/:sessionId/:versionNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;
  const versionNumber = params?.versionNumber ? parseInt(params.versionNumber) : 1;

  const [isConverting, setIsConverting] = useState(false);
  const [isIntegrating, setIsIntegrating] = useState(false);

  const { data, isLoading, error } = useQuery<EPMData>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber],
    enabled: !!sessionId && !isConverting,
    retry: false
  });

  const integrateMutation = useMutation({
    mutationFn: async () => {
      setIsIntegrating(true);
      const response = await fetch(`/api/strategic-consultant/integrate/${sessionId}/${versionNumber}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Integration failed');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setIsIntegrating(false);
      toast({
        title: "EPM Integration Complete!",
        description: `Program created successfully with ${data.summary.workstreamsCreated} workstreams, ${data.summary.tasksCreated} tasks, ${data.summary.stageGatesCreated} stage gates, ${data.summary.kpisCreated} KPIs, and more.`,
      });
      // Invalidate both queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber] });
    },
    onError: (error: any) => {
      setIsIntegrating(false);
      toast({
        title: "Integration failed",
        description: error.message || "Failed to integrate program into EPM Suite",
        variant: "destructive"
      });
    }
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      setIsConverting(true);
      // 180 second timeout for EPM conversion with Claude
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);

      try {
        const response = await fetch('/api/strategic-consultant/convert-to-epm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, versionNumber }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'EPM conversion failed');
        }
        
        return response.json();
      } catch (error: any) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
          throw new Error('EPM conversion timeout (>180s). The program structure is complex - please try again.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber] });
      setIsConverting(false);
      toast({
        title: "EPM Program Generated",
        description: "Complete program structure with all metadata"
      });
    },
    onError: (error: any) => {
      setIsConverting(false);
      toast({
        title: "Conversion failed",
        description: error.message || "An unexpected error occurred during EPM conversion",
        variant: "destructive"
      });
    }
  });

  // Auto-trigger conversion if no program data AND decisions are selected
  useEffect(() => {
    if (!isLoading && data && !data.version?.program && !error && !isConverting && sessionId) {
      const version = data.version as any;
      const hasSelectedDecisions = version?.selectedDecisions && 
        Object.keys(version.selectedDecisions).length > 0;
      
      if (hasSelectedDecisions) {
        convertMutation.mutate();
      }
    }
  }, [isLoading, data, error, isConverting, sessionId]);

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

  if (isLoading || isConverting || convertMutation.isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Generating EPM Program with Claude Sonnet 4...</p>
          <p className="text-xs text-muted-foreground">This may take up to 3 minutes for complete metadata</p>
        </div>
      </div>
    );
  }

  if (error || !data || !data.version?.program) {
    const version = data?.version as any;
    const hasSelectedDecisions = version?.selectedDecisions && 
      Object.keys(version.selectedDecisions).length > 0;
    
    if (!error && !hasSelectedDecisions) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Decisions Not Selected</AlertTitle>
            <AlertDescription className="space-y-4">
              <p>This strategy version needs decisions to be selected before it can be converted to an EPM program.</p>
              <Button 
                onClick={() => setLocation(`/strategic-consultant/decisions/${sessionId}/${versionNumber}`)}
                className="w-full"
                data-testid="button-select-decisions"
              >
                Select Decisions
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>EPM Program Not Found</AlertTitle>
          <AlertDescription>
            {error?.message || "Unable to load EPM program. Please try converting again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const program = data.program || data.version.program!;
  const validation = data.validation;
  const hasValidation = !!validation;
  const completeness = hasValidation ? validation!.ontology.completeness : null;
  const completenessPercent = completeness ? (completeness.score / completeness.maxScore) * 100 : 0;

  return (
    <AppLayout
      title={program.title}
      subtitle="Complete EPM program with metadata and validation"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Session: {sessionId}</span>
              <span>•</span>
              <span>Version: {versionNumber}</span>
              <span>•</span>
              <Badge variant={data.version.status === 'finalized' ? 'default' : 'secondary'}>
                {data.version.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data.version.status !== 'converted_to_program' && (
              <Button
                onClick={() => integrateMutation.mutate()}
                disabled={isIntegrating || integrateMutation.isPending}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-integrate-epm"
              >
                {isIntegrating || integrateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Integrating to EPM Suite...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Integrate to EPM Suite
                  </>
                )}
              </Button>
            )}
            {data.version.status === 'converted_to_program' && (
              <Badge variant="default" className="bg-green-600 text-lg px-4 py-2">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Integrated to EPM Suite
              </Badge>
            )}
            <Button
              onClick={() => setLocation(`/strategic-consultant/versions/${sessionId}`)}
              variant="outline"
              data-testid="button-view-versions"
            >
              View All Versions
            </Button>
          </div>
        </div>

        {hasValidation && completeness && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Program Quality Score
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Completeness</span>
                  <span className="font-bold" data-testid="text-completeness-score">
                    {completeness.score} / {completeness.maxScore}
                  </span>
                </div>
                <Progress value={completenessPercent} className="h-2" data-testid="progress-completeness" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Critical Fields:</span>
                <span className="ml-2 font-medium">{completeness.critical.passed}/{completeness.critical.total}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Important Fields:</span>
                <span className="ml-2 font-medium">{completeness.important.passed}/{completeness.important.total}</span>
              </div>
            </div>
            {completeness.missingFields.length === 0 && (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  All required EPM fields present - Ready for execution
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Budget Range
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-budget">
                ${(program.cost_estimate.total_min / 1000).toFixed(0)}K - ${(program.cost_estimate.total_max / 1000).toFixed(0)}K
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-timeline">{program.timeline.total_months} months</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Workstreams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-workstreams">{program.workstreams.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Approach
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="default" className="text-xs" data-testid="badge-approach">
                {program.strategic_approach.replace('_', ' ')}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="workstreams" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="workstreams">Workstreams</TabsTrigger>
            <TabsTrigger value="gates">Stage Gates</TabsTrigger>
            <TabsTrigger value="kpis">KPIs</TabsTrigger>
            <TabsTrigger value="benefits">Benefits</TabsTrigger>
            <TabsTrigger value="risks">Risks</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="workstreams" className="space-y-4 mt-6">
            {program.workstreams.map((ws, idx) => (
              <Card key={idx} data-testid={`card-workstream-${idx}`}>
                <CardHeader>
                  <CardTitle>{ws.title}</CardTitle>
                  <CardDescription>{ws.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Budget:</span>
                      <p className="font-medium">${(ws.cost_allocation.min / 1000).toFixed(0)}K - ${(ws.cost_allocation.max / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Timeline:</span>
                      <p className="font-medium">{ws.timeline_months} months</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Team Size:</span>
                      <p className="font-medium">{ws.required_team.reduce((sum: number, t: any) => sum + t.count, 0)} people</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Team Composition:</p>
                    <div className="flex flex-wrap gap-2">
                      {ws.required_team.map((member: any, i: number) => (
                        <Badge key={i} variant="outline">{member.count} {member.role}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Key Tasks ({ws.tasks.length}):</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {ws.tasks.slice(0, 3).map((task: any, i: number) => (
                        <li key={i} className="text-muted-foreground">{task.name}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="gates" className="space-y-4 mt-6">
            {program.stage_gates.map((gate, idx) => (
              <Card key={idx} data-testid={`card-gate-${gate.gate}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge>{gate.gate}</Badge>
                    {gate.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Criteria ({gate.criteria.length}):</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {gate.criteria.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Deliverables ({gate.deliverables.length}):</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {gate.deliverables.map((d: string, i: number) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="kpis" className="space-y-4 mt-6">
            {program.kpis.map((kpi, idx) => (
              <Card key={idx} data-testid={`card-kpi-${idx}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {kpi.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Target:</span>
                      <p className="font-medium">{kpi.target}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Frequency:</span>
                      <p className="font-medium">{kpi.measurement_frequency}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="benefits" className="space-y-4 mt-6">
            {program.benefits.map((benefit, idx) => (
              <Card key={idx} data-testid={`card-benefit-${idx}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle>{benefit.description}</CardTitle>
                    <Badge variant="secondary">{benefit.category}</Badge>
                  </div>
                </CardHeader>
                {benefit.quantified_value && (
                  <CardContent>
                    <p className="text-sm font-medium text-primary">{benefit.quantified_value}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="risks" className="space-y-4 mt-6">
            {program.risks.map((risk, idx) => (
              <Card key={idx} data-testid={`card-risk-${idx}`}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div className="flex-1">
                      <CardTitle className="text-base">{risk.description}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge variant={risk.likelihood === 'high' ? 'destructive' : 'outline'}>
                          {risk.likelihood} likelihood
                        </Badge>
                        <Badge variant={risk.impact === 'high' ? 'destructive' : 'outline'}>
                          {risk.impact} impact
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Mitigation:</span> {risk.mitigation_strategy}
                  </p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="resources" className="space-y-4 mt-6">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Funding Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {program.funding.sources.map((source, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{source.source}</span>
                        <span className="font-medium">${(source.amount / 1000).toFixed(0)}K</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resource Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {program.resources.map((resource, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="font-medium">{resource.role}</p>
                          <p className="text-sm text-muted-foreground">{resource.duration_months} months</p>
                        </div>
                        <Badge>{resource.count} person{resource.count > 1 ? 's' : ''}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
