import { useState } from "react";
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

interface BMCBlockFindings {
  blockType: string;
  blockName: string;
  description: string;
  confidence: string;
}

interface BMCResults {
  blocks: BMCBlockFindings[];
  recommendations: string[];
  assumptions?: Array<{
    claim: string;
    category: string;
    confidence: string;
  }>;
}

interface StrategyDecision {
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

export default function DecisionSummaryPage() {
  const [, params] = useRoute("/strategy-workspace/decisions/:sessionId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;

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

  // Fetch BMC results for this session
  const { data: bmcData, isLoading } = useQuery<{session: {accumulatedContext: {insights: {bmcBlocks?: any}}}, bmcResults?: BMCResults}>({
    queryKey: ['/api/journey-sessions', sessionId],
    enabled: !!sessionId,
  });

  // Save decision mutation
  const saveDecisionMutation = useMutation({
    mutationFn: async (decision: Partial<StrategyDecision>) => {
      // First, save the decision
      const decisionResponse = await apiRequest('POST', '/api/strategy-workspace/decisions', {
        journeySessionId: sessionId,
        ...decision,
      });
      const decisionData = await decisionResponse.json();
      
      // Then, generate EPM program
      const epmResponse = await apiRequest('POST', '/api/strategy-workspace/epm/generate', {
        journeySessionId: sessionId,
        decisionId: decisionData.decisionId,
      });
      return epmResponse.json();
    },
    onSuccess: (data) => {
      toast({
        title: "EPM Program Generated",
        description: `Created with ${Math.round(data.overallConfidence * 100)}% confidence`,
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

  // Extract BMC blocks for options
  const blocks = bmcData?.session?.accumulatedContext?.insights?.bmcBlocks || {};
  const customerSegments = blocks.customer_segments?.description || "Default customer segment";
  const revenueOptions = ["Subscription", "One-time purchase", "Freemium", "Usage-based", "Hybrid"];
  const channelOptions = ["Online", "Retail", "Direct sales", "Partnerships", "Mobile app"];
  const partnershipOptions = ["Go alone", "Strategic partnerships", "Joint venture", "Franchise"];
  const assumptions = bmcData?.bmcResults?.assumptions || [];
  const recommendations = bmcData?.bmcResults?.recommendations || ["Improve customer engagement", "Optimize pricing", "Expand channels"];

  return (
    <AppLayout
      title="Strategic Decision Summary"
      subtitle="Make key strategic choices to guide EPM program generation"
      onViewChange={() => setLocation('/')}
    >
      <div className="max-w-4xl mx-auto space-y-6">
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

        {/* Step 1: Strategic Choices */}
        {currentStep === 1 && (
          <Card data-testid="card-strategic-choices">
            <CardHeader>
              <CardTitle>Strategic Choices</CardTitle>
              <CardDescription>
                Select your primary strategic direction based on the BMC analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="customer-segment">Primary Customer Segment</Label>
                <Input
                  id="customer-segment"
                  value={decisionData.primaryCustomerSegment || ''}
                  onChange={(e) => updateDecision('primaryCustomerSegment', e.target.value)}
                  placeholder={customerSegments}
                  data-testid="input-customer-segment"
                />
                <p className="text-xs text-muted-foreground">From BMC: {customerSegments}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenue-model">Revenue Model</Label>
                <Select
                  value={decisionData.revenueModel || ''}
                  onValueChange={(value) => updateDecision('revenueModel', value)}
                >
                  <SelectTrigger id="revenue-model" data-testid="select-revenue-model">
                    <SelectValue placeholder="Select revenue model" />
                  </SelectTrigger>
                  <SelectContent>
                    {revenueOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Channel Priorities (select all that apply)</Label>
                <div className="space-y-2">
                  {channelOptions.map((channel) => (
                    <div key={channel} className="flex items-center space-x-2">
                      <Checkbox
                        id={`channel-${channel}`}
                        checked={decisionData.channelPriorities?.includes(channel)}
                        onCheckedChange={(checked) => {
                          const current = decisionData.channelPriorities || [];
                          updateDecision(
                            'channelPriorities',
                            checked
                              ? [...current, channel]
                              : current.filter((c) => c !== channel)
                          );
                        }}
                        data-testid={`checkbox-channel-${channel.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label htmlFor={`channel-${channel}`}>{channel}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnership-strategy">Partnership Strategy</Label>
                <RadioGroup
                  value={decisionData.partnershipStrategy || ''}
                  onValueChange={(value) => updateDecision('partnershipStrategy', value)}
                >
                  {partnershipOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={option}
                        id={`partnership-${option}`}
                        data-testid={`radio-partnership-${option.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label htmlFor={`partnership-${option}`}>{option}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Risk & Investment */}
        {currentStep === 2 && (
          <Card data-testid="card-risk-investment">
            <CardHeader>
              <CardTitle>Risk & Investment Parameters</CardTitle>
              <CardDescription>
                Define your risk tolerance and investment capacity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Risk Tolerance</Label>
                  <Badge variant="outline" data-testid="badge-risk-tolerance">
                    {decisionData.riskTolerance || 'balanced'}
                  </Badge>
                </div>
                <Slider
                  value={[
                    decisionData.riskTolerance === 'conservative' ? 0 :
                    decisionData.riskTolerance === 'balanced' ? 50 : 100
                  ]}
                  onValueChange={(values) => {
                    const val = values[0];
                    updateDecision(
                      'riskTolerance',
                      val < 33 ? 'conservative' : val < 67 ? 'balanced' : 'aggressive'
                    );
                  }}
                  max={100}
                  step={1}
                  className="w-full"
                  data-testid="slider-risk-tolerance"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Conservative</span>
                  <span>Balanced</span>
                  <span>Aggressive</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Investment Capacity Range</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="investment-min" className="text-xs">Minimum ($)</Label>
                    <Input
                      id="investment-min"
                      type="number"
                      value={decisionData.investmentCapacityMin || 0}
                      onChange={(e) => updateDecision('investmentCapacityMin', parseInt(e.target.value))}
                      data-testid="input-investment-min"
                    />
                  </div>
                  <div>
                    <Label htmlFor="investment-max" className="text-xs">Maximum ($)</Label>
                    <Input
                      id="investment-max"
                      type="number"
                      value={decisionData.investmentCapacityMax || 0}
                      onChange={(e) => updateDecision('investmentCapacityMax', parseInt(e.target.value))}
                      data-testid="input-investment-max"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeline-preference">Timeline Preference</Label>
                <RadioGroup
                  value={decisionData.timelinePreference || 'sustainable_pace'}
                  onValueChange={(value) => updateDecision('timelinePreference', value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fast_growth" id="fast-growth" data-testid="radio-timeline-fast" />
                    <Label htmlFor="fast-growth">Fast Growth (6-12 months)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sustainable_pace" id="sustainable" data-testid="radio-timeline-sustainable" />
                    <Label htmlFor="sustainable">Sustainable Pace (12-18 months)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="deliberate" id="deliberate" data-testid="radio-timeline-deliberate" />
                    <Label htmlFor="deliberate">Deliberate (18-24 months)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Success Metrics Priority (drag to reorder)</Label>
                {['Revenue', 'Market share', 'Profitability', 'Customer satisfaction'].map((metric, idx) => (
                  <div
                    key={metric}
                    className="p-3 border rounded bg-card flex items-center justify-between"
                    data-testid={`metric-${metric.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span>{metric}</span>
                    <Badge variant="secondary">Priority {idx + 1}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Assumptions */}
        {currentStep === 3 && (
          <Card data-testid="card-assumptions">
            <CardHeader>
              <CardTitle>Assumption Validation</CardTitle>
              <CardDescription>
                Confirm or flag concerns about key assumptions from the analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assumptions.length > 0 ? (
                assumptions.slice(0, 5).map((assumption: any, idx: number) => (
                  <div key={idx} className="border p-4 rounded-lg space-y-2" data-testid={`assumption-${idx}`}>
                    <div className="flex items-start justify-between">
                      <p className="font-medium flex-1">{assumption.claim}</p>
                      <Badge variant="outline">{assumption.confidence || 'medium'}</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id={`confirm-${idx}`} data-testid={`checkbox-confirm-${idx}`} />
                      <Label htmlFor={`confirm-${idx}`}>Confirmed</Label>
                    </div>
                    <Textarea
                      placeholder="Any concerns or modifications?"
                      className="mt-2"
                      data-testid={`textarea-concern-${idx}`}
                    />
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No assumptions available to validate.</p>
              )}

              <div className="space-y-2 mt-6">
                <Label htmlFor="general-concerns">General Concerns or Unknowns</Label>
                <Textarea
                  id="general-concerns"
                  placeholder="List any additional concerns or areas of uncertainty..."
                  rows={4}
                  onChange={(e) => updateDecision('concerns', e.target.value.split('\n').filter(c => c.trim()))}
                  data-testid="textarea-general-concerns"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Priorities & Go/No-Go */}
        {currentStep === 4 && (
          <Card data-testid="card-priorities-decision">
            <CardHeader>
              <CardTitle>Priority Ranking & Final Decision</CardTitle>
              <CardDescription>
                Rank your top priorities and make your go/no-go decision
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Top 5 Priorities (these become Stage 1 initiatives)</Label>
                <p className="text-xs text-muted-foreground">Select from recommendations:</p>
                <div className="space-y-2">
                  {recommendations.slice(0, 5).map((rec: string, idx: number) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <Checkbox
                        id={`priority-${idx}`}
                        checked={decisionData.topPriorities?.includes(rec)}
                        onCheckedChange={(checked) => {
                          const current = decisionData.topPriorities || [];
                          updateDecision(
                            'topPriorities',
                            checked
                              ? [...current, rec]
                              : current.filter((p) => p !== rec)
                          );
                        }}
                        data-testid={`checkbox-priority-${idx}`}
                      />
                      <Label htmlFor={`priority-${idx}`} className="flex-1">{rec}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <Label className="text-lg font-semibold">Go/No-Go Decision</Label>
                <RadioGroup
                  value={decisionData.goDecision || ''}
                  onValueChange={(value) => updateDecision('goDecision', value)}
                >
                  <div
                    className={`border-2 rounded-lg p-4 ${
                      decisionData.goDecision === 'proceed' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="proceed" id="proceed" data-testid="radio-proceed" />
                      <Label htmlFor="proceed" className="text-base font-semibold cursor-pointer">
                        Proceed with Strategy
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 ml-6">
                      Generate EPM program and begin execution planning
                    </p>
                  </div>

                  <div
                    className={`border-2 rounded-lg p-4 ${
                      decisionData.goDecision === 'pivot' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pivot" id="pivot" data-testid="radio-pivot" />
                      <Label htmlFor="pivot" className="text-base font-semibold cursor-pointer">
                        Pivot Approach
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 ml-6">
                      Restart journey with different assumptions
                    </p>
                  </div>

                  <div
                    className={`border-2 rounded-lg p-4 ${
                      decisionData.goDecision === 'abandon' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="abandon" id="abandon" data-testid="radio-abandon" />
                      <Label htmlFor="abandon" className="text-base font-semibold cursor-pointer">
                        Abandon Strategy
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 ml-6">
                      Risk/cost too high - exit planning
                    </p>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="decision-rationale">Decision Rationale</Label>
                <Textarea
                  id="decision-rationale"
                  placeholder="Explain the reasoning behind your decision..."
                  rows={4}
                  value={decisionData.decisionRationale || ''}
                  onChange={(e) => updateDecision('decisionRationale', e.target.value)}
                  data-testid="textarea-rationale"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button onClick={handleNext} data-testid="button-next">
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!decisionData.goDecision || saveDecisionMutation.isPending}
              data-testid="button-submit-decisions"
            >
              {saveDecisionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Save & Generate EPM
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
