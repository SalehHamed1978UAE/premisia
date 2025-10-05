import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";

interface DecisionOption {
  id: string;
  label: string;
  description: string;
  cost_impact: string;
  implications: string[];
}

interface Decision {
  id: string;
  question: string;
  context: string;
  options: DecisionOption[];
}

interface DecisionsData {
  decisions: Decision[];
  versionNumber: number;
}

export default function DecisionPage() {
  const [, params] = useRoute("/strategic-consultant/decisions/:sessionId/:versionNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;
  const versionNumber = params?.versionNumber ? parseInt(params.versionNumber) : 1;

  const [selectedDecisions, setSelectedDecisions] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery<DecisionsData>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber],
    enabled: !!sessionId,
  });

  const selectDecisionsMutation = useMutation({
    mutationFn: async (decisions: Record<string, string>) => {
      return apiRequest('POST', '/api/strategic-consultant/decisions/select', {
        sessionId,
        versionNumber,
        selectedDecisions: decisions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber] });
      toast({
        title: "Decisions saved",
        description: "Your strategic decisions have been recorded"
      });
      setLocation(`/strategic-consultant/epm/${sessionId}/${versionNumber}`);
    },
    onError: (error: any) => {
      if (error.message?.includes('rate limit')) {
        toast({
          title: "Rate limit reached",
          description: "Please wait a moment before trying again",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Failed to save decisions",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive"
        });
      }
    }
  });

  const handleDecisionChange = (decisionId: string, optionId: string) => {
    setSelectedDecisions(prev => ({
      ...prev,
      [decisionId]: optionId
    }));
  };

  const handleProceed = () => {
    if (!data?.decisions) return;

    const allSelected = data.decisions.every(d => selectedDecisions[d.id]);
    
    if (!allSelected) {
      toast({
        title: "Incomplete selection",
        description: "Please make a selection for all strategic decisions",
        variant: "destructive"
      });
      return;
    }

    selectDecisionsMutation.mutate(selectedDecisions);
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
          <p className="text-muted-foreground">Loading strategic decisions...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.decisions) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Decisions Not Found</AlertTitle>
          <AlertDescription>
            {error?.message || "Unable to load decisions. Please try analyzing again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const allSelected = data.decisions.every(d => selectedDecisions[d.id]);
  const selectionCount = Object.keys(selectedDecisions).length;

  return (
    <AppLayout
      title="Strategic Decisions"
      subtitle="Select strategic options for your EPM program"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Session: {sessionId} | Version: {versionNumber}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-2" data-testid="text-selection-progress">
              {selectionCount} / {data.decisions.length} selected
            </div>
            <Button
              onClick={handleProceed}
              disabled={!allSelected || selectDecisionsMutation.isPending}
              data-testid="button-convert-epm"
            >
              {selectDecisionsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Convert to EPM Program <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {data.decisions.map((decision, index) => (
            <Card key={decision.id} data-testid={`card-decision-${decision.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      Decision {index + 1}: {decision.question}
                    </CardTitle>
                    <CardDescription className="mt-2">{decision.context}</CardDescription>
                  </div>
                  {selectedDecisions[decision.id] && (
                    <Badge variant="default" data-testid={`badge-selected-${decision.id}`}>Selected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedDecisions[decision.id] || ''}
                  onValueChange={(value) => handleDecisionChange(decision.id, value)}
                  className="space-y-4"
                >
                  {decision.options.map((option) => (
                    <div
                      key={option.id}
                      className={`border rounded-lg p-4 transition-all ${
                        selectedDecisions[decision.id] === option.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      data-testid={`option-${decision.id}-${option.id}`}
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={option.id} id={`${decision.id}-${option.id}`} className="mt-1" />
                        <div className="flex-1 space-y-2">
                          <Label
                            htmlFor={`${decision.id}-${option.id}`}
                            className="text-base font-semibold cursor-pointer"
                          >
                            {option.label}
                          </Label>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                          
                          <div className="flex items-center gap-4 text-xs">
                            <Badge variant="outline" className="font-normal">
                              {option.cost_impact}
                            </Badge>
                          </div>

                          {option.implications.length > 0 && (
                            <div className="pt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Implications:</p>
                              <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                                {option.implications.map((implication, idx) => (
                                  <li key={idx}>{implication}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            onClick={handleProceed}
            disabled={!allSelected || selectDecisionsMutation.isPending}
            data-testid="button-convert-epm-bottom"
          >
            {selectDecisionsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Decisions...
              </>
            ) : (
              <>
                Convert to EPM Program <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
