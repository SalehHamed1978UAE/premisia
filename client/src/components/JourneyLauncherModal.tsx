import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Rocket, CheckCircle2, AlertCircle, Loader2, Play, Clock } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface JourneyLauncherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  understandingId: string;
  strategyTitle: string;
  contextMetrics: {
    entityCount: number;
    referenceCount: number;
    completedFrameworks: string[];
  };
}

interface JourneyDefinition {
  type: string;
  name: string;
  description: string;
  frameworks: string[];
  estimatedDuration: string;
  available: boolean;
  isCustom?: boolean;
  templateId?: string;
}

interface FrameworkDefinition {
  id: string;
  frameworkKey?: string;
  name: string;
  description: string;
  available: boolean;
  isActive?: boolean;
}

interface ReadinessResponse {
  success: boolean;
  ready: boolean;
  canRunInBackground: boolean;
  context: {
    entityCount: number;
    referenceCount: number;
    hasUserInput: boolean;
  };
  missingRequirements: string[];
  recommendation: string;
}

export default function JourneyLauncherModal({
  open,
  onOpenChange,
  understandingId,
  strategyTitle,
  contextMetrics,
}: JourneyLauncherModalProps) {
  const [selectedJourney, setSelectedJourney] = useState<string | null>(null);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("journey");
  const { toast } = useToast();

  // Fetch prebuilt journeys from registry
  const { data: prebuiltJourneysData, isLoading: loadingPrebuilt } = useQuery<any>({
    queryKey: ['/api/strategic-consultant/journey-registry'],
    enabled: open,
  });

  // Fetch custom journey templates
  const { data: customTemplatesData, isLoading: loadingCustom } = useQuery<any>({
    queryKey: ['/api/journey-builder/templates'],
    enabled: open,
  });

  // Fetch available frameworks for single framework mode
  const { data: frameworksData, isLoading: loadingFrameworks } = useQuery<any>({
    queryKey: ['/api/journey-builder/frameworks'],
    enabled: open,
  });

  // Merge and transform journey data
  const journeys: JourneyDefinition[] = [
    // Prebuilt journeys from registry
    ...(prebuiltJourneysData?.journeys || []).map((j: any) => ({
      type: j.type,
      name: j.name,
      description: j.description,
      frameworks: j.frameworks,
      estimatedDuration: j.estimatedDuration,
      available: j.available,
      isCustom: false,
    })),
    // Custom templates
    ...(customTemplatesData?.templates || []).map((t: any) => ({
      type: t.id,
      name: `Custom: ${t.name}`,
      description: t.description || 'User-created journey template',
      frameworks: (t.steps || []).map((s: any) => s.frameworkKey),
      estimatedDuration: t.estimatedDuration ? `${t.estimatedDuration} minutes` : 'Variable',
      available: t.isPublished !== false,
      isCustom: true,
      templateId: t.id,
    })),
  ];

  // Transform frameworks data
  const frameworks: FrameworkDefinition[] = (frameworksData?.frameworks || []).map((f: any) => ({
    id: f.frameworkKey || f.id,
    frameworkKey: f.frameworkKey,
    name: f.name,
    description: f.description || '',
    available: f.isActive !== false,
  }));

  const isLoadingData = loadingPrebuilt || loadingCustom || loadingFrameworks;

  // Check readiness when modal opens or selection changes
  const { data: readiness, isLoading: checkingReadiness } = useQuery<ReadinessResponse>({
    queryKey: ['/api/strategic-consultant/journeys/check-readiness', understandingId, selectedJourney, selectedFrameworks],
    enabled: open && (!!selectedJourney || selectedFrameworks.length > 0),
    queryFn: async () => {
      const response = await apiRequest('/api/strategic-consultant/journeys/check-readiness', {
        method: 'POST',
        body: JSON.stringify({
          understandingId,
          journeyType: selectedJourney,
          frameworks: selectedFrameworks,
        }),
      });
      return response;
    },
  });

  const handleJourneySelect = (journeyType: string) => {
    setSelectedJourney(journeyType);
    setSelectedFrameworks([]); // Clear framework selection when switching tabs
  };

  const handleFrameworkToggle = (frameworkId: string) => {
    setSelectedFrameworks(prev =>
      prev.includes(frameworkId)
        ? prev.filter(id => id !== frameworkId)
        : [...prev, frameworkId]
    );
  };

  const handleRunNow = () => {
    // Navigate to strategic consultant with preloaded context
    window.location.href = `/strategic-consultant/journey-selection/${understandingId}`;
    onOpenChange(false);
  };

  const startBackgroundMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/strategic-consultant/journeys/execute-background', {
        method: 'POST',
        body: JSON.stringify({
          understandingId,
          journeyType: selectedJourney,
          frameworks: selectedFrameworks,
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Analysis Started",
        description: data.message || "Your analysis is running in the background.",
      });
      onOpenChange(false);
      // Optionally redirect to tracking page or refresh current page
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Analysis",
        description: error.message || "An error occurred while starting the analysis.",
        variant: "destructive",
      });
    },
  });

  const handleStartInBackground = () => {
    startBackgroundMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Run Additional Analysis
          </DialogTitle>
          <DialogDescription>
            Continue analyzing <span className="font-semibold">{strategyTitle}</span> with full journeys or individual frameworks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Available Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">References:</span>{" "}
                  <span className="font-semibold">{contextMetrics.referenceCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Entities:</span>{" "}
                  <span className="font-semibold">{contextMetrics.entityCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>{" "}
                  <span className="font-semibold">{contextMetrics.completedFrameworks.length} frameworks</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Full Journey vs Single Framework */}
          <Tabs defaultValue="journey" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="journey" data-testid="tab-full-journey">Full Journey</TabsTrigger>
              <TabsTrigger value="framework" data-testid="tab-single-framework">Single Framework</TabsTrigger>
            </TabsList>

            {/* Full Journey Tab */}
            <TabsContent value="journey" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a comprehensive analysis journey that runs multiple frameworks in sequence
              </p>
              
              {isLoadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading available journeys...</span>
                </div>
              ) : journeys.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No journeys available at this time.</AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-3">
                  {journeys.map(journey => (
                  <Card
                    key={journey.type}
                    className={`cursor-pointer transition-all ${
                      selectedJourney === journey.type
                        ? 'ring-2 ring-primary'
                        : 'hover:shadow-md'
                    } ${!journey.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => journey.available && handleJourneySelect(journey.type)}
                    data-testid={`card-journey-${journey.type}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{journey.name}</CardTitle>
                          <CardDescription className="mt-1 text-xs">
                            {journey.description}
                          </CardDescription>
                        </div>
                        {selectedJourney === journey.type && (
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {journey.estimatedDuration}
                        </Badge>
                        {journey.frameworks.map(fw => (
                          <Badge key={fw} variant="outline" className="text-xs capitalize">
                            {fw.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {!journey.available && (
                          <Badge variant="outline" className="text-xs">
                            Coming Soon
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>
              )}

              {selectedJourney && !isLoadingData && (
                <>
                  {/* Readiness Status */}
                  {checkingReadiness ? (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>Checking context availability...</AlertDescription>
                    </Alert>
                  ) : readiness && !readiness.ready ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-semibold mb-2">{readiness.recommendation}</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {readiness.missingRequirements.map((req, idx) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : readiness?.ready ? (
                    <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        {readiness.recommendation}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                      Cancel
                    </Button>
                    <Button onClick={handleRunNow} variant="secondary" data-testid="button-run-now">
                      <Play className="h-4 w-4 mr-2" />
                      Run Now
                    </Button>
                    {readiness?.canRunInBackground && (
                      <Button 
                        onClick={handleStartInBackground} 
                        disabled={startBackgroundMutation.isPending}
                        data-testid="button-start-background"
                      >
                        {startBackgroundMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Clock className="h-4 w-4 mr-2" />
                        )}
                        Start in Background
                      </Button>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Single Framework Tab */}
            <TabsContent value="framework" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select one or more individual frameworks to analyze specific aspects of your strategy
              </p>
              
              {isLoadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading available frameworks...</span>
                </div>
              ) : frameworks.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No frameworks available at this time.</AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-3">
                  {frameworks.map(framework => (
                  <Card
                    key={framework.id}
                    className={`${
                      !framework.available ? 'opacity-50' : 'hover:shadow-sm'
                    } transition-shadow`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`framework-${framework.id}`}
                          checked={selectedFrameworks.includes(framework.id)}
                          onCheckedChange={() => framework.available && handleFrameworkToggle(framework.id)}
                          disabled={!framework.available}
                          data-testid={`checkbox-framework-${framework.id}`}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`framework-${framework.id}`}
                            className="text-base font-semibold cursor-pointer"
                          >
                            {framework.name}
                            {!framework.available && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Coming Soon
                              </Badge>
                            )}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {framework.description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                  ))}
                </div>
              )}

              {selectedFrameworks.length > 0 && !isLoadingData && (
                <>
                  {/* Readiness Status */}
                  {checkingReadiness ? (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>Checking context availability...</AlertDescription>
                    </Alert>
                  ) : readiness && !readiness.ready ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-semibold mb-2">{readiness.recommendation}</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {readiness.missingRequirements.map((req, idx) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : readiness?.ready ? (
                    <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        {readiness.recommendation}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-framework">
                      Cancel
                    </Button>
                    <Button onClick={handleRunNow} variant="secondary" data-testid="button-run-now-framework">
                      <Play className="h-4 w-4 mr-2" />
                      Run Now
                    </Button>
                    {readiness?.canRunInBackground && (
                      <Button 
                        onClick={handleStartInBackground} 
                        disabled={startBackgroundMutation.isPending}
                        data-testid="button-start-background-framework"
                      >
                        {startBackgroundMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Clock className="h-4 w-4 mr-2" />
                        )}
                        Start in Background
                      </Button>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}