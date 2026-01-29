import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface BMCBlock {
  blockName: string;
  description: string;
  keyFindings: string[];
  confidence: number;
}

interface BMCAnalysis {
  blocks: BMCBlock[];
  recommendations: string[];
  keyInsights: string[];
  criticalGaps: string[];
}

interface DecisionOption {
  id: string;
  label: string;
  description: string;
  estimated_cost?: { min: number; max: number };
  estimated_timeline_months?: number;
  pros: string[];
  cons: string[];
  recommended?: boolean;
  reasoning?: string;
}

interface DecisionPoint {
  id: string;
  title: string;
  question: string;
  context: string;
  options: DecisionOption[];
  impact_areas: string[];
}

interface GeneratedDecisions {
  decisions: DecisionPoint[];
  decision_flow: string;
  estimated_completion_time_minutes: number;
}

interface VersionData {
  id: string;
  versionNumber: number;
  status: string;
  analysis?: {
    bmc_research?: BMCAnalysis;
  };
  decisions?: GeneratedDecisions;
}

interface StrategyDecision {
  sessionId: string;
  versionNumber: number;
  primaryCustomerSegment: string;
  revenueModel: string;
  channelPriorities: string[];
  partnershipStrategy: string;
  riskTolerance: 'conservative' | 'balanced' | 'aggressive';
  investmentCapacityMin: number;
  investmentCapacityMax: number;
  timelinePreference: 'fast_growth' | 'sustainable_pace' | 'deliberate';
  successMetricsPriority: string[];
  validatedAssumptions: Array<{
    assumption: string;
    confirmed: boolean;
    concern: string;
  }>;
  concerns: string[];
  topPriorities: string[];
  goDecision: 'proceed' | 'pivot' | 'abandon';
  decisionRationale: string;
}

// Helper: Extract data from BMC blocks
function extractFromBlock(blocks: BMCBlock[], blockName: string): string {
  const block = blocks?.find(b => b.blockName === blockName);
  return block?.description || "";
}

// Helper: Extract list items from block description
function extractListItems(text: string): string[] {
  if (!text) return [];
  // Split by common delimiters and clean up
  return text
    .split(/[,;•\n]/)
    .map(item => item.trim())
    .filter(item => item.length > 0 && item.length < 100);
}

export default function DecisionSummaryPage() {
  const [, params] = useRoute("/strategy-workspace/decisions/:sessionId/:versionNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;
  const versionNumber = params?.versionNumber ? parseInt(params.versionNumber) : 1;

  const [currentStep, setCurrentStep] = useState(1);
  const [decisionData, setDecisionData] = useState<Partial<StrategyDecision>>({
    riskTolerance: 'balanced',
    timelinePreference: 'sustainable_pace',
    channelPriorities: [],
    successMetricsPriority: [],
    validatedAssumptions: [],
    concerns: [],
    topPriorities: [],
    investmentCapacityMin: 0,
    investmentCapacityMax: 500000,
  });

  // Fetch BMC analysis results
  const { data: versionResponse, isLoading } = useQuery<{ success: boolean; version: VersionData }>({
    queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber],
    enabled: !!sessionId,
  });

  const bmcAnalysis = versionResponse?.version?.analysis?.bmc_research;
  const blocks = bmcAnalysis?.blocks || [];
  const strategyVersionId = versionResponse?.version?.id;
  const generatedDecisions = versionResponse?.version?.decisions;
  
  // DEBUG: Log what we're actually receiving from the API
  useEffect(() => {
    if (versionResponse) {
      console.log('[DecisionSummaryPage] Version response:', {
        hasDecisions: !!versionResponse.version?.decisions,
        decisionsType: typeof versionResponse.version?.decisions,
        decisionsKeys: versionResponse.version?.decisions ? Object.keys(versionResponse.version.decisions) : [],
        decisionsData: versionResponse.version?.decisions,
        decisionCount: versionResponse.version?.decisions?.decisions?.length || 0,
      });
    }
  }, [versionResponse]);
  
  // Track which strategic decision options the user has selected
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Extract BMC data when loaded
  useEffect(() => {
    if (!bmcAnalysis || !blocks.length) return;

    // Extract customer segments
    const customerSegmentsText = extractFromBlock(blocks, "Customer Segments");
    
    // Extract channels
    const channelsText = extractFromBlock(blocks, "Channels");
    const extractedChannels = extractListItems(channelsText);
    
    // Extract revenue streams
    const revenueText = extractFromBlock(blocks, "Revenue Streams");
    
    // Extract partnerships
    const partnershipsText = extractFromBlock(blocks, "Key Partnerships");
    
    // Extract priorities from recommendations and insights
    // Handle both object {action, priority, rationale} and string formats
    const recommendationTexts = (bmcAnalysis.recommendations || []).map((rec: any) => 
      typeof rec === 'object' ? rec.action : rec
    );
    const priorities = [
      ...recommendationTexts,
      ...(bmcAnalysis.keyInsights || []).slice(0, 3),
    ].slice(0, 5);
    
    // Extract concerns from critical gaps
    const extractedConcerns = (bmcAnalysis.criticalGaps || []).map(gap => gap);

    // Pre-populate form with extracted data
    setDecisionData(prev => ({
      ...prev,
      primaryCustomerSegment: customerSegmentsText || prev.primaryCustomerSegment,
      revenueModel: revenueText || prev.revenueModel,
      channelPriorities: extractedChannels.length > 0 ? extractedChannels.slice(0, 3) : prev.channelPriorities,
      partnershipStrategy: partnershipsText || prev.partnershipStrategy,
      topPriorities: priorities.length > 0 ? priorities : prev.topPriorities,
      concerns: extractedConcerns.length > 0 ? extractedConcerns : prev.concerns,
    }));
  }, [bmcAnalysis, blocks]);

  // Save selected decisions mutation (for new strategic decisions flow)
  const saveSelectedDecisionsMutation = useMutation({
    mutationFn: async (selections: Record<string, string>) => {
      if (!strategyVersionId) {
        throw new Error('Strategy version ID not available');
      }
      
      // Save selected decisions to strategy version
      const response = await apiRequest('PATCH', `/api/strategic-consultant/versions/${sessionId}/${versionNumber}`, {
        selectedDecisions: selections,
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the version query cache to ensure fresh data on next page
      queryClient.invalidateQueries({ 
        queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber] 
      });
      
      // Navigate to prioritization page
      setLocation(`/strategy-workspace/prioritization/${sessionId}/${versionNumber}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save decisions",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Save decision mutation (for legacy 4-step wizard flow)
  // Now navigates to prioritization page instead of directly generating EPM
  const saveDecisionMutation = useMutation({
    mutationFn: async (decision: Partial<StrategyDecision>) => {
      if (!strategyVersionId) {
        throw new Error('Strategy version ID not available');
      }
      
      // Save the decision
      const decisionResponse = await apiRequest('POST', '/api/strategy-workspace/decisions', {
        strategyVersionId,
        ...decision,
      });
      return decisionResponse.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Decisions saved",
        description: "Proceeding to prioritization...",
      });
      // Navigate to prioritization page (which handles EPM generation)
      setLocation(`/strategy-workspace/prioritization/${sessionId}/${versionNumber}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save decisions",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateDecision = (field: string, value: any) => {
    setDecisionData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    if (!decisionData.goDecision) {
      toast({
        title: "Go/No-Go decision required",
        description: "Please select whether to proceed, pivot, or abandon",
        variant: "destructive",
      });
      return;
    }
    saveDecisionMutation.mutate(decisionData as StrategyDecision);
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Session</AlertTitle>
          <AlertDescription>No session ID provided</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading analysis results...</p>
        </div>
      </div>
    );
  }

  // Dynamic options extracted from BMC
  const channelOptionsFromBMC = extractListItems(extractFromBlock(blocks, "Channels"));
  const channelOptions = channelOptionsFromBMC.length > 0 
    ? channelOptionsFromBMC 
    : ["Online", "Retail", "Direct sales", "Partnerships", "Mobile app"];
    
  // Handle both object {action, priority, rationale} and string formats for recommendations
  const recommendationsForPriorities = (bmcAnalysis?.recommendations || []).map((rec: any) =>
    typeof rec === 'object' ? rec.action : rec
  );

  return (
    <AppLayout
      title="Strategic Decision Summary"
      subtitle="Make key strategic choices to guide EPM program generation"
    >
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-0">
        {/* Strategic Decisions Section - Show AI-generated decisions first */}
        {generatedDecisions && generatedDecisions.decisions && generatedDecisions.decisions.length > 0 && (
          <Card className="border-primary" data-testid="card-strategic-decisions">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Strategic Decisions</CardTitle>
              <CardDescription>
                Select strategic options for your EPM program
              </CardDescription>
              {generatedDecisions.decision_flow && (
                <p className="text-sm text-muted-foreground mt-2 break-words">{generatedDecisions.decision_flow}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
              {generatedDecisions.decisions.map((decision, index) => (
                <div key={decision.id} className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg" data-testid={`decision-${index}`}>
                  <div>
                    <h3 className="text-lg font-semibold">{decision.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{decision.context}</p>
                    <p className="font-medium mt-2">{decision.question}</p>
                  </div>
                  
                  <RadioGroup
                    value={selectedOptions[decision.id] || ''}
                    onValueChange={(value) => setSelectedOptions(prev => ({ ...prev, [decision.id]: value }))}
                  >
                    {decision.options.map((option) => (
                      <div
                        key={option.id}
                        className={`border rounded-lg p-4 space-y-3 ${
                          selectedOptions[decision.id] === option.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        data-testid={`option-${option.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={option.id} className="font-semibold cursor-pointer flex items-center gap-2">
                              {option.label}
                              {option.recommended && <Badge variant="default">Recommended</Badge>}
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                            
                            {option.estimated_cost && (
                              <p className="text-sm font-medium mt-2">
                                Cost: ${(option.estimated_cost.min / 1000000).toFixed(1)}M - ${(option.estimated_cost.max / 1000000).toFixed(1)}M
                              </p>
                            )}
                            {option.estimated_timeline_months && (
                              <p className="text-sm font-medium">Timeline: {option.estimated_timeline_months} months</p>
                            )}
                            
                            {option.pros && option.pros.length > 0 && (
                              <div className="mt-2">
                                <p className="text-sm font-semibold">Pros:</p>
                                <ul className="text-sm space-y-1 ml-4">
                                  {option.pros.map((pro, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-green-600 mt-1">•</span>
                                      <span>{pro}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {option.cons && option.cons.length > 0 && (
                              <div className="mt-2">
                                <p className="text-sm font-semibold">Cons:</p>
                                <ul className="text-sm space-y-1 ml-4">
                                  {option.cons.map((con, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-red-600 mt-1">•</span>
                                      <span>{con}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {option.reasoning && (
                              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                <p className="text-sm"><span className="font-semibold">Research insight:</span> {option.reasoning}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              
              <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-4">
                {Object.keys(selectedOptions).length < generatedDecisions.decisions.length && (
                  <p className="text-sm text-amber-600 sm:mr-auto">
                    Please select an option for all {generatedDecisions.decisions.length} strategic decisions
                    ({Object.keys(selectedOptions).length}/{generatedDecisions.decisions.length} selected)
                  </p>
                )}
                <Button
                  onClick={() => {
                    // Validate all decisions have selections
                    if (Object.keys(selectedOptions).length < generatedDecisions.decisions.length) {
                      toast({
                        title: "Missing selections",
                        description: "Please select an option for all strategic decisions",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Save selected decisions and navigate to prioritization
                    saveSelectedDecisionsMutation.mutate(selectedOptions);
                  }}
                  disabled={Object.keys(selectedOptions).length < generatedDecisions.decisions.length || saveSelectedDecisionsMutation.isPending}
                  data-testid="button-proceed-prioritization"
                  className="w-full sm:w-auto"
                  size="lg"
                >
                  {saveSelectedDecisionsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Proceed to Prioritization
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Legacy 4-step wizard - only show if NO strategic decisions exist */}
        {(!generatedDecisions || !generatedDecisions.decisions || generatedDecisions.decisions.length === 0) && (
          <>
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep === step
                    ? 'bg-primary text-primary-foreground'
                    : currentStep > step
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
                data-testid={`step-indicator-${step}`}
              >
                {currentStep > step ? <CheckCircle2 className="h-5 w-5" /> : step}
              </div>
              {step < 4 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    currentStep > step ? 'bg-green-500' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Page 1: Strategic Choices */}
        {currentStep === 1 && (
          <Card data-testid="card-page-1">
            <CardHeader>
              <CardTitle>Page 1: Strategic Choices</CardTitle>
              <CardDescription>
                Define your core business model decisions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="customer-segment">Primary Customer Segment</Label>
                <Textarea
                  id="customer-segment"
                  data-testid="input-customer-segment"
                  placeholder="e.g., Young professionals aged 25-35 in urban areas"
                  value={decisionData.primaryCustomerSegment || ''}
                  onChange={(e) => updateDecision('primaryCustomerSegment', e.target.value)}
                  className="min-h-[80px]"
                />
                {bmcAnalysis && (
                  <p className="text-xs text-muted-foreground">
                    From BMC analysis: {blocks.find(b => b.blockName === "Customer Segments")?.description.substring(0, 100)}...
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenue-model">Revenue Model</Label>
                <Textarea
                  id="revenue-model"
                  data-testid="input-revenue-model"
                  placeholder="e.g., Subscription-based with premium tiers"
                  value={decisionData.revenueModel || ''}
                  onChange={(e) => updateDecision('revenueModel', e.target.value)}
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Channel Priorities</Label>
                <div className="space-y-2">
                  {channelOptions.map((channel) => (
                    <div key={channel} className="flex items-center space-x-2">
                      <Checkbox
                        id={`channel-${channel}`}
                        data-testid={`checkbox-channel-${channel.toLowerCase().replace(/\s+/g, '-')}`}
                        checked={decisionData.channelPriorities?.includes(channel)}
                        onCheckedChange={(checked) => {
                          const current = decisionData.channelPriorities || [];
                          updateDecision(
                            'channelPriorities',
                            checked 
                              ? [...current, channel]
                              : current.filter(c => c !== channel)
                          );
                        }}
                      />
                      <label htmlFor={`channel-${channel}`} className="text-sm cursor-pointer">
                        {channel}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnership-strategy">Partnership Strategy</Label>
                <Textarea
                  id="partnership-strategy"
                  data-testid="input-partnership-strategy"
                  placeholder="e.g., Strategic partnerships with complementary brands"
                  value={decisionData.partnershipStrategy || ''}
                  onChange={(e) => updateDecision('partnershipStrategy', e.target.value)}
                  className="min-h-[60px]"
                />
              </div>

              <Button onClick={handleNext} className="w-full" data-testid="button-next">
                Next: Risk & Investment <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Page 2: Risk & Investment */}
        {currentStep === 2 && (
          <Card data-testid="card-page-2">
            <CardHeader>
              <CardTitle>Page 2: Risk & Investment</CardTitle>
              <CardDescription>
                Set your risk tolerance and investment parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="risk-tolerance">Risk Tolerance</Label>
                <Select
                  value={decisionData.riskTolerance}
                  onValueChange={(value) => updateDecision('riskTolerance', value)}
                >
                  <SelectTrigger id="risk-tolerance" data-testid="select-risk-tolerance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative - Minimize risk</SelectItem>
                    <SelectItem value="balanced">Balanced - Moderate risk/reward</SelectItem>
                    <SelectItem value="aggressive">Aggressive - Maximize growth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Investment Capacity</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="investment-min" className="text-xs text-muted-foreground">Minimum ($)</Label>
                    <Input
                      id="investment-min"
                      type="number"
                      data-testid="input-investment-min"
                      value={decisionData.investmentCapacityMin}
                      onChange={(e) => updateDecision('investmentCapacityMin', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="investment-max" className="text-xs text-muted-foreground">Maximum ($)</Label>
                    <Input
                      id="investment-max"
                      type="number"
                      data-testid="input-investment-max"
                      value={decisionData.investmentCapacityMax}
                      onChange={(e) => updateDecision('investmentCapacityMax', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeline-preference">Timeline Preference</Label>
                <Select
                  value={decisionData.timelinePreference}
                  onValueChange={(value) => updateDecision('timelinePreference', value)}
                >
                  <SelectTrigger id="timeline-preference" data-testid="select-timeline-preference">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast_growth">Fast Growth - Aggressive timeline</SelectItem>
                    <SelectItem value="sustainable_pace">Sustainable Pace - Balanced timeline</SelectItem>
                    <SelectItem value="deliberate">Deliberate - Conservative timeline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="success-metrics">Success Metrics Priority</Label>
                <Input
                  id="success-metrics"
                  data-testid="input-success-metrics"
                  placeholder="e.g., Revenue growth, Customer retention, Market share"
                  value={decisionData.successMetricsPriority?.join(', ') || ''}
                  onChange={(e) => updateDecision('successMetricsPriority', e.target.value.split(',').map(s => s.trim()))}
                />
              </div>

              <div className="flex gap-4">
                <Button onClick={handleBack} variant="outline" className="flex-1" data-testid="button-back">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleNext} className="flex-1" data-testid="button-next">
                  Next: Assumptions <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Page 3: Assumptions & Concerns */}
        {currentStep === 3 && (
          <Card data-testid="card-page-3">
            <CardHeader>
              <CardTitle>Page 3: Assumptions & Concerns</CardTitle>
              <CardDescription>
                Validate assumptions and identify concerns from the analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="assumptions">Validated Assumptions</Label>
                <Textarea
                  id="assumptions"
                  data-testid="textarea-assumptions"
                  placeholder="List key assumptions you agree with (one per line)"
                  value={decisionData.validatedAssumptions?.map(a => a.assumption).join('\n') || ''}
                  onChange={(e) => {
                    const assumptions = e.target.value.split('\n').filter(a => a.trim());
                    updateDecision('validatedAssumptions', assumptions.map(a => ({
                      assumption: a,
                      confirmed: true,
                      concern: ''
                    })));
                  }}
                  className="min-h-[120px]"
                />
                {bmcAnalysis?.keyInsights && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">From analysis:</p>
                    {bmcAnalysis.keyInsights.slice(0, 3).map((insight, idx) => (
                      <p key={idx}>• {insight}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="concerns">Concerns & Risks</Label>
                <Textarea
                  id="concerns"
                  data-testid="textarea-concerns"
                  placeholder="List your concerns and potential risks (one per line)"
                  value={decisionData.concerns?.join('\n') || ''}
                  onChange={(e) => updateDecision('concerns', e.target.value.split('\n').filter(c => c.trim()))}
                  className="min-h-[120px]"
                />
                {bmcAnalysis?.criticalGaps && bmcAnalysis.criticalGaps.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Critical gaps identified:</p>
                    {bmcAnalysis.criticalGaps.slice(0, 3).map((gap, idx) => (
                      <p key={idx}>• {gap}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <Button onClick={handleBack} variant="outline" className="flex-1" data-testid="button-back">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleNext} className="flex-1" data-testid="button-next">
                  Next: Priorities <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Page 4: Priorities & Go Decision */}
        {currentStep === 4 && (
          <Card data-testid="card-page-4">
            <CardHeader>
              <CardTitle>Page 4: Priorities & Go Decision</CardTitle>
              <CardDescription>
                Set final priorities and make your go/no-go decision
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="priorities">Top Priorities</Label>
                <Textarea
                  id="priorities"
                  data-testid="textarea-priorities"
                  placeholder="List your top 3-5 priorities (one per line)"
                  value={decisionData.topPriorities?.join('\n') || ''}
                  onChange={(e) => updateDecision('topPriorities', e.target.value.split('\n').filter(p => p.trim()))}
                  className="min-h-[120px]"
                />
                {recommendationsForPriorities.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Recommendations from analysis:</p>
                    {recommendationsForPriorities.slice(0, 5).map((rec: string, idx: number) => (
                      <p key={idx}>• {typeof rec === 'object' ? (rec as any).action : rec}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Go/No-Go Decision</Label>
                <RadioGroup
                  value={decisionData.goDecision}
                  onValueChange={(value) => updateDecision('goDecision', value)}
                  data-testid="select-go-decision"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="proceed" id="go-proceed" data-testid="radio-proceed" />
                    <Label htmlFor="go-proceed" className="cursor-pointer">
                      <span className="font-semibold text-green-600">Proceed</span> - Move forward with this strategy
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pivot" id="go-pivot" data-testid="radio-pivot" />
                    <Label htmlFor="go-pivot" className="cursor-pointer">
                      <span className="font-semibold text-yellow-600">Pivot</span> - Modify the strategy before proceeding
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="abandon" id="go-abandon" data-testid="radio-abandon" />
                    <Label htmlFor="go-abandon" className="cursor-pointer">
                      <span className="font-semibold text-red-600">Abandon</span> - Do not pursue this strategy
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rationale">Decision Rationale</Label>
                <Textarea
                  id="rationale"
                  data-testid="textarea-rationale"
                  placeholder="Explain the reasoning behind your decision..."
                  value={decisionData.decisionRationale || ''}
                  onChange={(e) => updateDecision('decisionRationale', e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex gap-4">
                <Button onClick={handleBack} variant="outline" className="flex-1" data-testid="button-back">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  className="flex-1" 
                  disabled={saveDecisionMutation.isPending}
                  data-testid="button-save-generate"
                >
                  {saveDecisionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating EPM...
                    </>
                  ) : (
                    <>
                      Save & Generate EPM <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
          </>
        )}

        {/* Summary of extracted data for debugging */}
        {bmcAnalysis && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm">Data Extracted from BMC Analysis</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div>
                <strong>Blocks found:</strong> {blocks.map(b => b.blockName).join(', ')}
              </div>
              <div>
                <strong>Recommendations:</strong> {bmcAnalysis.recommendations?.length || 0}
              </div>
              <div>
                <strong>Key Insights:</strong> {bmcAnalysis.keyInsights?.length || 0}
              </div>
              <div>
                <strong>Critical Gaps:</strong> {bmcAnalysis.criticalGaps?.length || 0}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
