import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowUp,
  ArrowDown,
  Lightbulb,
  AlertTriangle,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface VersionData {
  id: string;
  versionNumber: number;
  analysis?: {
    bmc_research?: {
      keyInsights?: string[];
      criticalGaps?: string[];
      recommendations?: Array<string | { action: string }>;
    };
  };
  decisions?: {
    decisions?: Array<{
      id: string;
      title: string;
      question: string;
      options: Array<{
        id: string;
        label: string;
        description: string;
        recommended?: boolean;
      }>;
    }>;
  };
  selectedDecisions?: Record<string, string>; // decisionId -> optionId
}

interface PrioritizedItem {
  id: string;
  title: string;
  description: string;
  isRecommended: boolean;
  decisionId: string;
}

export default function PrioritizationPage() {
  const [, params] = useRoute("/strategy-workspace/prioritization/:sessionId/:versionNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const sessionId = params?.sessionId || '';
  const versionNumber = params?.versionNumber ? parseInt(params.versionNumber) : 1;

  // Fetch strategy version data
  const { data: response, isLoading, error } = useQuery<{ success: boolean; version: VersionData }>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber],
    enabled: !!sessionId,
  });

  const versionData = response?.version;
  const strategyVersionId = versionData?.id;

  // Build prioritized items from selected decisions
  const [prioritizedItems, setPrioritizedItems] = useState<PrioritizedItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize prioritized items when data loads
  if (versionData && !initialized) {
    const items: PrioritizedItem[] = [];
    const decisions = versionData.decisions?.decisions || [];
    const selectedDecisions = versionData.selectedDecisions || {};

    decisions.forEach((decision) => {
      const selectedOptionId = selectedDecisions[decision.id];
      if (selectedOptionId) {
        const option = decision.options.find(opt => opt.id === selectedOptionId);
        if (option) {
          items.push({
            id: option.id,
            title: option.label,
            description: option.description,
            isRecommended: option.recommended || false,
            decisionId: decision.id,
          });
        }
      }
    });

    setPrioritizedItems(items);
    setInitialized(true);
  }

  // Extract insights and gaps
  const bmcAnalysis = versionData?.analysis?.bmc_research;
  const keyInsights = bmcAnalysis?.keyInsights || [];
  const criticalGaps = bmcAnalysis?.criticalGaps || [];

  // Generate EPM mutation
  const generateEPMMutation = useMutation({
    mutationFn: async () => {
      if (!strategyVersionId) {
        throw new Error('Strategy version ID not available');
      }

      // Save prioritized order
      const prioritizedOrder = prioritizedItems.map(item => item.id);

      // Generate EPM program with prioritized recommendations
      const epmResponse = await apiRequest('POST', '/api/strategy-workspace/epm/generate', {
        strategyVersionId,
        prioritizedOrder,
      });
      return epmResponse.json();
    },
    onSuccess: (data) => {
      toast({
        title: "EPM Program Generated",
        description: `Created with ${Math.round(parseFloat(data.overallConfidence) * 100)}% confidence`,
      });
      // Navigate to EPM view
      setLocation(`/strategy-workspace/epm/${data.epmProgramId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate EPM",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...prioritizedItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    // Swap items
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setPrioritizedItems(newItems);
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Prioritize Strategic Initiatives"
        subtitle="Organize your strategic choices by priority"
        onViewChange={() => setLocation('/')}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading strategy data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !response) {
    return (
      <AppLayout
        title="Prioritize Strategic Initiatives"
        subtitle="Organize your strategic choices by priority"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-2xl mx-auto py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load strategy data'}
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  if (prioritizedItems.length === 0 && initialized) {
    return (
      <AppLayout
        title="Prioritize Strategic Initiatives"
        subtitle="Organize your strategic choices by priority"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-2xl mx-auto py-12">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Strategic Decisions</AlertTitle>
            <AlertDescription>
              No strategic decisions found. Please complete the decision-making process first.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => setLocation(`/strategy-workspace/decisions/${sessionId}/${versionNumber}`)}>
              Go to Decisions
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Prioritize Strategic Initiatives"
      subtitle="Drag to reorder initiatives by priority - highest priority at the top"
      onViewChange={() => setLocation('/')}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Instructions */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Finalize Your Strategic Priorities
            </CardTitle>
            <CardDescription>
              Your strategic choices are listed below. Use the arrows to reorder them by priority. 
              The top item will become your primary focus in the EPM program.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Analysis Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keyInsights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {keyInsights.slice(0, 3).map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span className="text-muted-foreground">{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {criticalGaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Critical Gaps to Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {criticalGaps.slice(0, 3).map((gap, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-orange-500 font-bold mt-0.5">•</span>
                      <span className="text-muted-foreground">{gap}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Prioritized Items */}
        <Card>
          <CardHeader>
            <CardTitle>Strategic Initiatives (in priority order)</CardTitle>
            <CardDescription>
              {prioritizedItems.length} {prioritizedItems.length === 1 ? 'initiative' : 'initiatives'} selected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {prioritizedItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-start gap-4 p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                data-testid={`priority-item-${index}`}
              >
                {/* Priority Number */}
                <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                  <Badge variant={index === 0 ? "default" : "outline"} className="text-lg font-bold">
                    #{index + 1}
                  </Badge>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="h-6 w-6 p-0"
                      data-testid={`button-move-up-${index}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === prioritizedItems.length - 1}
                      className="h-6 w-6 p-0"
                      data-testid={`button-move-down-${index}`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Item Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{item.title}</h4>
                    {item.isRecommended && (
                      <Badge variant="default" className="text-xs">
                        AI Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border-2 border-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Ready to Generate Your EPM Program?</h3>
                <p className="text-sm text-muted-foreground">
                  Your strategic initiatives will be converted into a complete EPM program with workstreams 
                  structured according to your priority order.
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => generateEPMMutation.mutate()}
                disabled={generateEPMMutation.isPending || prioritizedItems.length === 0}
                data-testid="button-generate-epm"
              >
                {generateEPMMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate EPM Program'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="flex justify-start">
          <Button
            variant="outline"
            onClick={() => setLocation(`/strategy-workspace/decisions/${sessionId}/${versionNumber}`)}
            data-testid="button-back-decisions"
          >
            ← Back to Decisions
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
