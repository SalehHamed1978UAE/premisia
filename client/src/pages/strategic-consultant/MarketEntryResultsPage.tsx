import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  CheckCircle2, ArrowRight, Loader2, Globe, Building2, BarChart3,
  TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, Shield
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// PESTLE factor icons
const pestleIcons: Record<string, any> = {
  political: Globe,
  economic: TrendingUp,
  social: Building2,
  technological: BarChart3,
  legal: Shield,
  environmental: Globe,
};

// Force score color based on threat level
const getScoreColor = (score: number) => {
  if (score <= 3) return "bg-green-500";
  if (score <= 6) return "bg-yellow-500";
  return "bg-red-500";
};

const getScoreLabel = (score: number) => {
  if (score <= 3) return "Low";
  if (score <= 6) return "Medium";
  return "High";
};

// SWOT quadrant colors
const swotColors = {
  strengths: "border-green-500 bg-green-50 dark:bg-green-950/20",
  weaknesses: "border-red-500 bg-red-50 dark:bg-red-950/20",
  opportunities: "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
  threats: "border-amber-500 bg-amber-50 dark:bg-amber-950/20",
};

export default function MarketEntryResultsPage() {
  const [, setLocation] = useLocation();
  const { sessionId, versionNumber } = useParams<{ sessionId: string; versionNumber: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pestle");

  // Fetch analysis results from strategy version
  const { data: versionData, isLoading, error } = useQuery({
    queryKey: ['/api/strategic-consultant/versions', sessionId, versionNumber],
    enabled: !!sessionId && !!versionNumber,
  });

  const analysisData = (versionData as any)?.analysisData || {};
  const pestleData = analysisData?.pestle?.pestleResults || analysisData?.pestle;
  const portersData = analysisData?.porters?.portersResults || analysisData?.porters;
  const swotData = analysisData?.swot?.output || analysisData?.swot;

  // Navigate to strategic decisions
  const handleContinueToDecisions = () => {
    setLocation(`/strategy-workspace/decisions/${sessionId}/${versionNumber}`);
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Market Entry Analysis"
        subtitle="Loading your analysis..."
        onViewChange={() => setLocation('/')}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading analysis results...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !versionData) {
    return (
      <AppLayout
        title="Market Entry Analysis"
        subtitle="Error loading results"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-2xl mx-auto">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                {(error as any)?.message || 'Failed to load analysis results'}
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation('/strategic-consultant/input')}
                className="mt-4"
              >
                Start New Analysis
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Market Entry Analysis Complete"
      subtitle="Review your PESTLE, Porter's Five Forces, and SWOT analysis"
      onViewChange={() => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Completion Banner */}
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    Market Entry Analysis Complete!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Review your PESTLE → Porter's → SWOT analysis below
                  </p>
                </div>
              </div>
              <Button onClick={handleContinueToDecisions} className="gap-2">
                Continue to Strategic Decisions <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pestle" className="gap-2">
              <Globe className="h-4 w-4" /> PESTLE Analysis
            </TabsTrigger>
            <TabsTrigger value="porters" className="gap-2">
              <Building2 className="h-4 w-4" /> Porter's Five Forces
            </TabsTrigger>
            <TabsTrigger value="swot" className="gap-2">
              <Target className="h-4 w-4" /> SWOT Analysis
            </TabsTrigger>
          </TabsList>

          {/* PESTLE Tab */}
          <TabsContent value="pestle" className="space-y-4">
            {pestleData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {['political', 'economic', 'social', 'technological', 'legal', 'environmental'].map((factor) => {
                  const Icon = pestleIcons[factor] || Globe;
                  const data = pestleData[factor];
                  if (!data) return null;
                  
                  return (
                    <Card key={factor}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base capitalize">
                          <Icon className="h-4 w-4" />
                          {factor}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {data.trends?.slice(0, 3).map((trend: any, i: number) => (
                          <div key={i} className="text-sm">
                            <p className="font-medium">{trend.description}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                Strength: {trend.strength}/10
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {trend.timeframe}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        {data.opportunities?.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-green-600 mb-1">Opportunities:</p>
                            {data.opportunities.slice(0, 2).map((opp: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                • {opp.description || opp}
                              </p>
                            ))}
                          </div>
                        )}
                        {data.risks?.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-red-600 mb-1">Risks:</p>
                            {data.risks.slice(0, 2).map((risk: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                • {risk.description || risk}
                              </p>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">PESTLE analysis data not available</p>
                </CardContent>
              </Card>
            )}
            
            {/* Strategic Recommendations */}
            {pestleData?.strategicRecommendations?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" /> Strategic Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {pestleData.strategicRecommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Porter's Tab */}
          <TabsContent value="porters" className="space-y-4">
            {portersData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: 'threatOfNewEntrants', label: 'Threat of New Entrants', icon: TrendingUp },
                    { key: 'bargainingPowerOfSuppliers', label: 'Supplier Power', icon: Building2 },
                    { key: 'bargainingPowerOfBuyers', label: 'Buyer Power', icon: Target },
                    { key: 'threatOfSubstitutes', label: 'Substitutes Threat', icon: AlertTriangle },
                    { key: 'competitiveRivalry', label: 'Competitive Rivalry', icon: BarChart3 },
                  ].map(({ key, label, icon: Icon }) => {
                    const force = portersData[key];
                    if (!force) return null;
                    
                    return (
                      <Card key={key}>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center justify-between text-base">
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {label}
                            </span>
                            <Badge className={`${getScoreColor(force.score)} text-white`}>
                              {force.score}/10
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Progress value={force.score * 10} className="h-2" />
                          <p className="text-sm text-muted-foreground">{force.analysis}</p>
                          
                          {force.barriers?.length > 0 && (
                            <div className="pt-2 border-t">
                              <p className="text-xs font-medium mb-1">Barriers:</p>
                              {force.barriers.slice(0, 2).map((b: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground">• {b}</p>
                              ))}
                            </div>
                          )}
                          
                          {force.risks?.length > 0 && (
                            <div className="pt-2 border-t">
                              <p className="text-xs font-medium text-red-600 mb-1">Risks:</p>
                              {force.risks.slice(0, 2).map((r: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground">• {r}</p>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                
                {/* Overall Attractiveness */}
                {portersData.overallAttractiveness && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Market Attractiveness</span>
                        <Badge className={`${getScoreColor(10 - portersData.overallAttractiveness.score)} text-white`}>
                          {portersData.overallAttractiveness.score}/10
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {portersData.overallAttractiveness.summary}
                      </p>
                      {portersData.overallAttractiveness.recommendations?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Recommendations:</p>
                          <ul className="space-y-1">
                            {portersData.overallAttractiveness.recommendations.map((rec: string, i: number) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-primary">•</span> {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">Porter's Five Forces data not available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* SWOT Tab */}
          <TabsContent value="swot" className="space-y-4">
            {swotData ? (
              <>
                {/* SWOT 2x2 Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <Card className={swotColors.strengths}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-green-700 dark:text-green-300">
                        Strengths (Internal Positive)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {swotData.strengths?.map((s: any, i: number) => (
                        <div key={i} className="mb-3 last:mb-0">
                          <p className="text-sm font-medium">{s.factor}</p>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                          <Badge variant="outline" className="mt-1 text-xs">{s.importance}</Badge>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No strengths identified</p>}
                    </CardContent>
                  </Card>

                  {/* Weaknesses */}
                  <Card className={swotColors.weaknesses}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-red-700 dark:text-red-300">
                        Weaknesses (Internal Negative)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {swotData.weaknesses?.map((w: any, i: number) => (
                        <div key={i} className="mb-3 last:mb-0">
                          <p className="text-sm font-medium">{w.factor}</p>
                          <p className="text-xs text-muted-foreground">{w.description}</p>
                          <Badge variant="outline" className="mt-1 text-xs">{w.importance}</Badge>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No weaknesses identified</p>}
                    </CardContent>
                  </Card>

                  {/* Opportunities */}
                  <Card className={swotColors.opportunities}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-blue-700 dark:text-blue-300">
                        Opportunities (External Positive)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {swotData.opportunities?.map((o: any, i: number) => (
                        <div key={i} className="mb-3 last:mb-0">
                          <p className="text-sm font-medium">{o.factor}</p>
                          <p className="text-xs text-muted-foreground">{o.description}</p>
                          <Badge variant="outline" className="mt-1 text-xs">{o.importance}</Badge>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No opportunities identified</p>}
                    </CardContent>
                  </Card>

                  {/* Threats */}
                  <Card className={swotColors.threats}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-amber-700 dark:text-amber-300">
                        Threats (External Negative)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {swotData.threats?.map((t: any, i: number) => (
                        <div key={i} className="mb-3 last:mb-0">
                          <p className="text-sm font-medium">{t.factor}</p>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                          <Badge variant="outline" className="mt-1 text-xs">{t.importance}</Badge>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No threats identified</p>}
                    </CardContent>
                  </Card>
                </div>

                {/* Strategic Options (TOWS) */}
                {swotData.strategicOptions && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Strategic Options (TOWS Matrix)</CardTitle>
                      <CardDescription>Strategies derived from SWOT combinations</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {swotData.strategicOptions.soStrategies?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-green-600 mb-2">SO Strategies (Strength → Opportunity)</p>
                          <ul className="space-y-1">
                            {swotData.strategicOptions.soStrategies.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {swotData.strategicOptions.woStrategies?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-blue-600 mb-2">WO Strategies (Weakness → Opportunity)</p>
                          <ul className="space-y-1">
                            {swotData.strategicOptions.woStrategies.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {swotData.strategicOptions.stStrategies?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-amber-600 mb-2">ST Strategies (Strength → Threat)</p>
                          <ul className="space-y-1">
                            {swotData.strategicOptions.stStrategies.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {swotData.strategicOptions.wtStrategies?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-red-600 mb-2">WT Strategies (Weakness → Threat)</p>
                          <ul className="space-y-1">
                            {swotData.strategicOptions.wtStrategies.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Priority Actions */}
                {swotData.priorityActions?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4" /> Priority Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {swotData.priorityActions.map((action: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary font-bold">{i + 1}.</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">SWOT analysis data not available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Continue Button at Bottom */}
        <div className="flex justify-center pt-4">
          <Button size="lg" onClick={handleContinueToDecisions} className="gap-2">
            Continue to Strategic Decisions <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
