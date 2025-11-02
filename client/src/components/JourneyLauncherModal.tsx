import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Rocket, CheckCircle2, AlertCircle, Loader2, Play, ChevronDown, ChevronUp, Clock, Lightbulb } from "lucide-react";
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

export default function JourneyLauncherModal({
  open,
  onOpenChange,
  understandingId,
  strategyTitle,
  contextMetrics,
}: JourneyLauncherModalProps) {
  const [, setLocation] = useLocation();
  const [selectedJourney, setSelectedJourney] = useState<string | null>(null);
  const [selectedJourneyType, setSelectedJourneyType] = useState<'prebuilt' | 'custom' | null>(null);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("journey");
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const { toast } = useToast();

  // Reset scroll position when modal opens
  useEffect(() => {
    if (open) {
      const scrollContainer = document.querySelector('[data-modal-scroll]');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  }, [open]);

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

  // Fetch journey summary when a journey is selected
  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['/api/strategic-consultant/journeys/summary', understandingId, selectedJourney],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/strategic-consultant/journeys/summary', {
        understandingId,
        journeyType: selectedJourney,
      });
      return response.json();
    },
    enabled: open && !!selectedJourney && selectedJourneyType === 'prebuilt',
  });

  const summary = summaryData?.summary;

  const isLoadingData = loadingPrebuilt || loadingCustom || loadingFrameworks;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Clear opposite selection when switching tabs
    if (value === 'journey') {
      setSelectedFrameworks([]);
    } else if (value === 'framework') {
      setSelectedJourney(null);
      setSelectedJourneyType(null);
    }
  };

  const handleJourneySelect = (journeyType: string, isCustom: boolean) => {
    setSelectedJourney(journeyType);
    setSelectedJourneyType(isCustom ? 'custom' : 'prebuilt');
  };

  const handleFrameworkToggle = (frameworkId: string) => {
    setSelectedFrameworks(prev =>
      prev.includes(frameworkId)
        ? prev.filter(id => id !== frameworkId)
        : [...prev, frameworkId]
    );
  };

  // Execute mutation - when NOT ready, initialize journey and navigate to wizard
  const executeJourneyMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        understandingId,
      };
      
      // Include journey type for prebuilt journeys
      if (activeTab === 'journey' && selectedJourney && selectedJourneyType === 'prebuilt') {
        payload.journeyType = selectedJourney;
      } else {
        // For framework-only or custom templates, we'd need different handling
        // For now, this flow is primarily for prebuilt journeys
        throw new Error('Interactive wizard currently only supports prebuilt journeys');
      }
      
      const response = await apiRequest('POST', '/api/strategic-consultant/journeys/execute', payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      // Don't close modal - keep it open with loading state until navigation
      // This prevents black screen during transition
      // Navigate to the first page in the journey wizard using client-side routing
      setLocation(data.navigationUrl);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Journey",
        description: error.message || "An error occurred.",
        variant: "destructive",
      });
    },
  });

  // Run Now mutation - starts journey wizard using strategic summary from completed sessions
  const runNowMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        understandingId,
        journeyType: selectedJourney,
      };
      
      const response = await apiRequest('POST', '/api/strategic-consultant/journeys/run-now', payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      // Don't close modal - keep it open with loading state until navigation
      // This prevents black screen during transition
      
      // Store journey session ID and version number for later use
      if (data.journeySessionId) {
        localStorage.setItem(`current-journey-session-${understandingId}`, data.journeySessionId);
      }
      // Store journey type using sessionId (consistent with URL routing)
      if (data.sessionId && selectedJourney) {
        localStorage.setItem(`journey-type-${data.sessionId}`, selectedJourney);
        console.log(`[JourneyLauncher] Stored journey type ${selectedJourney} for sessionId ${data.sessionId}`);
      }
      if (data.versionNumber) {
        // Store by BOTH sessionId formats so all downstream requests can find it
        localStorage.setItem(`journey-version-${data.journeySessionId}`, String(data.versionNumber));
        if (data.sessionId) {
          localStorage.setItem(`journey-version-${data.sessionId}`, String(data.versionNumber));
        }
        console.log(`[JourneyLauncher] Stored version ${data.versionNumber} for both sessionId formats`);
      }
      // Navigate to the journey wizard using client-side routing
      if (data.navigationUrl) {
        setLocation(data.navigationUrl);
      } else {
        // Fallback - reload page if no navigation URL provided
        window.location.reload();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Journey",
        description: error.message || "An error occurred while starting the journey.",
        variant: "destructive",
      });
    },
  });

  const isLoading = executeJourneyMutation.isPending || runNowMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] lg:max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0">
        {/* Loading Overlay - prevents black screen during journey start */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div>
                <p className="text-lg font-semibold">Starting your journey...</p>
                <p className="text-sm text-muted-foreground mt-1">Please wait while we prepare your analysis</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Rocket className="h-4 w-4 sm:h-5 sm:w-5" />
              Run Additional Analysis
            </DialogTitle>
            <DialogDescription className="text-sm">
              Continue analyzing <span className="font-semibold">{strategyTitle}</span> with full journeys or individual frameworks
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-4" data-modal-scroll>
          {/* Context Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Available Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
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
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
                    onClick={() => journey.available && handleJourneySelect(journey.type, journey.isCustom || false)}
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

            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky Footer - Shows when journey selected */}
        {selectedJourney && !isLoadingData && (
          <div className="border-t bg-background px-4 sm:px-6 py-4">
            {/* Summary Snippet - shown only for prebuilt journeys with previous runs */}
            {activeTab === 'journey' && selectedJourneyType === 'prebuilt' && summary && (
              <div className="mb-4">
                <Collapsible open={summaryExpanded} onOpenChange={setSummaryExpanded}>
                  <Card className="border-primary/20 bg-primary/5" data-testid="card-journey-summary">
                    <CardHeader className="pb-2">
                      <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-semibold">
                            Previous Analysis (Version {summary.versionNumber})
                          </CardTitle>
                        </div>
                        {summaryExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </CollapsibleTrigger>
                      {summary.completedAt && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          Completed: {new Date(summary.completedAt).toLocaleDateString()}
                        </p>
                      )}
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="pt-2 space-y-3">
                        {summary.keyInsights && summary.keyInsights.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              Key Insights:
                            </p>
                            <ul className="space-y-1 text-xs text-foreground">
                              {summary.keyInsights.map((insight: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{insight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {summary.strategicImplications && summary.strategicImplications.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              Strategic Implications:
                            </p>
                            <ul className="space-y-1 text-xs text-foreground">
                              {summary.strategicImplications.map((implication: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">→</span>
                                  <span>{implication}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            )}

            {/* Loading indicator for summary */}
            {activeTab === 'journey' && selectedJourneyType === 'prebuilt' && loadingSummary && (
              <div className="mb-4">
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>Loading previous analysis...</AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                data-testid="button-cancel"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              
              {/* Run Now button - only for prebuilt journeys */}
              {activeTab === 'journey' && selectedJourneyType === 'prebuilt' && (
                <Button 
                  onClick={() => runNowMutation.mutate()} 
                  disabled={runNowMutation.isPending}
                  data-testid="button-run-now"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {runNowMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {runNowMutation.isPending ? 'Running...' : 'Run Now'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}