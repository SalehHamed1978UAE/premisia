import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, AlertCircle, Edit, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Textarea } from "@/components/ui/textarea";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useKnowledgeInsights } from "@/hooks/useKnowledgeInsights";
import { KnowledgeInsightsCard } from "@/components/knowledge/KnowledgeInsightsCard";
import {
  ExecutiveSummaryFormatter,
  WorkstreamsFormatter,
  TimelineFormatter,
  ResourcePlanFormatter,
  FinancialPlanFormatter,
  BenefitsRealizationFormatter,
  RiskRegisterFormatter,
  StageGatesFormatter,
  KPIsFormatter,
  StakeholderMapFormatter,
  GovernanceFormatter,
  QAPlanFormatter,
  ProcurementFormatter,
  ExitStrategyFormatter,
} from "@/components/epm/EPMFormatters";
import GanttChartView from "@/components/epm/GanttChartView";
import AssignmentsPanel from "@/components/epm/AssignmentsPanel";
import ResourceWorkloadView from "@/components/epm/ResourceWorkloadView";
import type {
  ExecutiveSummary,
  Workstream,
  Timeline,
  ResourcePlan,
  FinancialPlan,
  BenefitsRealization,
  RiskRegister,
  StageGates,
  KPIs,
  StakeholderMap,
  Governance,
  QAPlan,
  Procurement,
  ExitStrategy,
} from "@/types/intelligence";

interface EPMProgram {
  id: string;
  frameworkType: string;
  status: string;
  overallConfidence: string;
  componentConfidence: Record<string, number>;
  executiveSummary: ExecutiveSummary;
  workstreams: Workstream[];
  timeline: Timeline;
  resourcePlan: ResourcePlan;
  financialPlan: FinancialPlan;
  benefitsRealization: BenefitsRealization;
  riskRegister: RiskRegister;
  stageGates: StageGates;
  kpis: KPIs;
  stakeholderMap: StakeholderMap;
  governance: Governance;
  qaPlan: QAPlan;
  procurement: Procurement;
  exitStrategy: ExitStrategy;
  editTracking: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const variant = percentage > 80 ? 'default' : percentage > 60 ? 'secondary' : 'destructive';
  const color = percentage > 80 ? 'text-green-600' : percentage > 60 ? 'text-yellow-600' : 'text-red-600';
  
  return (
    <Badge variant={variant} className={color}>
      {percentage}% confidence
    </Badge>
  );
}

export default function EPMProgramView() {
  const [, params] = useRoute("/strategy-workspace/epm/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const programId = params?.id;
  const { knowledgeGraph: knowledgeGraphEnabled } = useFeatureFlags();

  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Fetch EPM program
  const { data, isLoading, error } = useQuery<{program: EPMProgram}>({
    queryKey: ['/api/strategy-workspace/epm', programId],
    enabled: !!programId,
  });

  // Fetch session ID for Knowledge Graph insights
  const { data: sessionData } = useQuery<{ sessionId: string | null }>({
    queryKey: ['/api/strategy-workspace/epm', programId, 'session'],
    queryFn: async () => {
      const res = await fetch(`/api/strategy-workspace/epm/${programId}/session`, {
        credentials: 'include',
      });
      if (!res.ok) return { sessionId: null };
      return res.json();
    },
    enabled: knowledgeGraphEnabled && !!programId,
  });

  // Fetch Knowledge Graph insights
  const {
    data: insightsData,
    isLoading: insightsLoading,
    error: insightsError
  } = useKnowledgeInsights(sessionData?.sessionId || null, {
    enabled: knowledgeGraphEnabled && !!sessionData?.sessionId,
  });

  // Finalize mutation
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/strategy-workspace/epm/${programId}/finalize`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategy-workspace/epm', programId] });
      toast({
        title: "EPM Program Finalized",
        description: "Your program is now ready for execution",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to finalize",
        description: error.message || "Please review low-confidence components",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (component: string, currentValue: any) => {
    setEditingComponent(component);
    setEditValue(JSON.stringify(currentValue, null, 2));
  };

  const handleSave = async (component: string) => {
    try {
      const parsedValue = JSON.parse(editValue);
      await apiRequest('PATCH', `/api/strategy-workspace/epm/${programId}`, {
        component,
        value: parsedValue,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/strategy-workspace/epm', programId] });
      setEditingComponent(null);
      toast({
        title: "Component updated",
        description: `${component} has been saved`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to save",
        description: error.message || "Invalid JSON format",
        variant: "destructive",
      });
    }
  };

  if (!programId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Program</AlertTitle>
          <AlertDescription>No program ID provided</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading EPM program...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.program) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Program Not Found</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'EPM program not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const program = data.program;
  const overallConfidence = parseFloat(program.overallConfidence);

  // Component renderer that uses formatters
  const renderComponent = (component: string, data: any) => {
    const formatters: Record<string, (props: { data: any }) => JSX.Element> = {
      executiveSummary: ExecutiveSummaryFormatter,
      workstreams: WorkstreamsFormatter,
      timeline: TimelineFormatter,
      resourcePlan: ResourcePlanFormatter,
      financialPlan: FinancialPlanFormatter,
      benefitsRealization: BenefitsRealizationFormatter,
      riskRegister: RiskRegisterFormatter,
      stageGates: StageGatesFormatter,
      kpis: KPIsFormatter,
      stakeholderMap: StakeholderMapFormatter,
      governance: GovernanceFormatter,
      qaPlan: QAPlanFormatter,
      procurement: ProcurementFormatter,
      exitStrategy: ExitStrategyFormatter,
    };

    const Formatter = formatters[component];
    
    if (!Formatter) {
      return (
        <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }

    return <Formatter data={data} />;
  };

  const ComponentCard = ({ title, component, data, confidence }: any) => {
    const isEditing = editingComponent === component;
    const isModified = program.editTracking?.[component]?.modified;

    return (
      <Card className={isModified ? 'border-blue-500' : ''}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {title}
                {isModified && (
                  <Badge variant="outline" className="text-blue-600">
                    User Modified
                  </Badge>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={confidence} />
              {program.status === 'draft' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => isEditing ? handleSave(component) : handleEdit(component, data)}
                  data-testid={`button-edit-${component}`}
                >
                  {isEditing ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              data-testid={`textarea-edit-${component}`}
            />
          ) : (
            renderComponent(component, data)
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout
      title="EPM Program"
      subtitle={`Generated from ${program.frameworkType.toUpperCase()} analysis`}
      onViewChange={() => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Overall Status */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
              <div>
                <CardTitle>Program Overview</CardTitle>
                <CardDescription>
                  Status: <Badge>{program.status}</Badge>
                  {program.finalizedAt && ` • Finalized on ${new Date(program.finalizedAt).toLocaleDateString()}`}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" data-testid="text-overall-confidence">
                  {Math.round(overallConfidence * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Overall Confidence</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Confidence Warning */}
        {overallConfidence < 0.8 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Low Confidence Detected</AlertTitle>
            <AlertDescription>
              This program has lower than recommended confidence ({Math.round(overallConfidence * 100)}%). 
              Review and edit components marked with yellow or red badges before finalizing.
            </AlertDescription>
          </Alert>
        )}

        {/* Knowledge Graph Insights - Before you launch */}
        {knowledgeGraphEnabled && sessionData?.sessionId && (
          <KnowledgeInsightsCard
            title="Before You Launch"
            insights={insightsData ? {
              similarStrategies: insightsData.similarStrategies || [],
              incentives: insightsData.incentives || [],
            } : undefined}
            loading={insightsLoading}
            error={insightsError}
            hasConsent={insightsData?.hasConsent}
          />
        )}

        {/* Component Tabs - NOW WITH 8 TABS INCLUDING GANTT */}
        <Tabs defaultValue="summary" className="space-y-4">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <TabsList className="inline-flex sm:grid sm:grid-cols-8 w-full min-w-max sm:min-w-0 px-4 sm:px-0">
              <TabsTrigger value="summary" className="flex-shrink-0 px-3 sm:px-4 text-sm">Summary</TabsTrigger>
              <TabsTrigger value="timeline" className="flex-shrink-0 px-3 sm:px-4 text-sm">Timeline</TabsTrigger>
              <TabsTrigger value="planning" className="flex-shrink-0 px-3 sm:px-4 text-sm">Planning</TabsTrigger>
              <TabsTrigger value="resources" className="flex-shrink-0 px-3 sm:px-4 text-sm">Resources</TabsTrigger>
              <TabsTrigger value="benefits" className="flex-shrink-0 px-3 sm:px-4 text-sm">Benefits</TabsTrigger>
              <TabsTrigger value="risks" className="flex-shrink-0 px-3 sm:px-4 text-sm">Risks</TabsTrigger>
              <TabsTrigger value="governance" className="flex-shrink-0 px-3 sm:px-4 text-sm">Gov</TabsTrigger>
              <TabsTrigger value="other" className="flex-shrink-0 px-3 sm:px-4 text-sm">Other</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="summary" className="space-y-4">
            <ComponentCard
              title="Executive Summary"
              component="executiveSummary"
              data={program.executiveSummary}
              confidence={program.componentConfidence.executiveSummary || 0.75}
            />
          </TabsContent>

          {/* NEW GANTT CHART TAB */}
          <TabsContent value="timeline" className="space-y-4">
            <GanttChartView
              workstreams={program.workstreams}
              timeline={program.timeline}
              stageGates={program.stageGates}
            />
          </TabsContent>

          <TabsContent value="planning" className="space-y-4">
            <ComponentCard
              title="Workstreams"
              component="workstreams"
              data={program.workstreams}
              confidence={program.componentConfidence.workstreams || 0.75}
            />
            <ComponentCard
              title="Timeline"
              component="timeline"
              data={program.timeline}
              confidence={program.componentConfidence.timeline || 0.75}
            />
            <ComponentCard
              title="Stage Gates"
              component="stageGates"
              data={program.stageGates}
              confidence={program.componentConfidence.stageGates || 0.75}
            />
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <ComponentCard
              title="Resource Plan"
              component="resourcePlan"
              data={program.resourcePlan}
              confidence={program.componentConfidence.resourcePlan || 0.75}
            />
            <ComponentCard
              title="Financial Plan"
              component="financialPlan"
              data={program.financialPlan}
              confidence={program.componentConfidence.financialPlan || 0.75}
            />
            
            {/* Task Assignments */}
            <AssignmentsPanel
              programId={program.id}
              workstreams={program.workstreams}
              resourcePlan={program.resourcePlan}
              readonly={program.status === 'finalized'}
            />
            
            {/* Resource Workload */}
            <ResourceWorkloadView programId={program.id} />
          </TabsContent>

          <TabsContent value="benefits" className="space-y-4">
            <ComponentCard
              title="Benefits Realization"
              component="benefitsRealization"
              data={program.benefitsRealization}
              confidence={program.componentConfidence.benefitsRealization || 0.75}
            />
            <ComponentCard
              title="KPIs"
              component="kpis"
              data={program.kpis}
              confidence={program.componentConfidence.kpis || 0.75}
            />
          </TabsContent>

          <TabsContent value="risks" className="space-y-4">
            <ComponentCard
              title="Risk Register"
              component="riskRegister"
              data={program.riskRegister}
              confidence={program.componentConfidence.riskRegister || 0.75}
            />
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <ComponentCard
              title="Stakeholder Map"
              component="stakeholderMap"
              data={program.stakeholderMap}
              confidence={program.componentConfidence.stakeholderMap || 0.75}
            />
            <ComponentCard
              title="Governance"
              component="governance"
              data={program.governance}
              confidence={program.componentConfidence.governance || 0.75}
            />
          </TabsContent>

          <TabsContent value="other" className="space-y-4">
            <ComponentCard
              title="QA Plan"
              component="qaPlan"
              data={program.qaPlan}
              confidence={program.componentConfidence.qaPlan || 0.75}
            />
            <ComponentCard
              title="Procurement"
              component="procurement"
              data={program.procurement}
              confidence={program.componentConfidence.procurement || 0.75}
            />
            <ComponentCard
              title="Exit Strategy"
              component="exitStrategy"
              data={program.exitStrategy}
              confidence={program.componentConfidence.exitStrategy || 0.75}
            />
          </TabsContent>
        </Tabs>

        {/* Actions */}
        {program.status === 'draft' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">Ready to Finalize?</h3>
                  <p className="text-sm text-muted-foreground">
                    Review all components above and finalize when ready
                  </p>
                </div>
                <Button
                  onClick={() => finalizeMutation.mutate()}
                  disabled={finalizeMutation.isPending || overallConfidence < 0.6}
                  data-testid="button-finalize"
                  className="w-full sm:w-auto whitespace-nowrap"
                >
                  {finalizeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4 flex-shrink-0" />
                      Finalize EPM Program
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {program.status === 'finalized' && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Program Finalized</AlertTitle>
            <AlertDescription>
              This EPM program is complete and ready for execution. No further edits can be made.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
