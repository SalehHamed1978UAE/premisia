import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

// Journey definitions (MUST match server-side registry exactly)
const JOURNEYS = [
  {
    type: 'business_model_innovation',
    name: 'Business Model Innovation',
    description: 'Identify root problems using Five Whys, then design solutions with Business Model Canvas',
    frameworks: ['Five Whys', 'Business Model Canvas'],
    bestFor: ['New product/service ideas', 'Subscription model challenges', 'Revenue model changes'],
    available: true,
  },
  {
    type: 'market_entry',
    name: 'Market Entry Strategy',
    description: 'Analyze market dynamics and competitive forces to plan market entry',
    frameworks: ['Market Research', 'Porter\'s Five Forces', 'Business Model Canvas'],
    bestFor: ['Geographic expansion', 'New market segments', 'Product launches'],
    available: false,
  },
  {
    type: 'competitive_strategy',
    name: 'Competitive Strategy',
    description: 'Deep-dive into competitive landscape and strategic positioning',
    frameworks: ['Porter\'s Five Forces', 'PESTLE Analysis', 'Strategic Options'],
    bestFor: ['Competitive threats', 'Market positioning', 'Differentiation strategy'],
    available: false,
  },
  {
    type: 'digital_transformation',
    name: 'Digital Transformation',
    description: 'Roadmap for technology adoption and organizational change',
    frameworks: ['Current State Analysis', 'Technology Assessment', 'Change Management'],
    bestFor: ['Technology upgrades', 'Process automation', 'Digital initiatives'],
    available: false,
  },
  {
    type: 'crisis_recovery',
    name: 'Crisis Recovery',
    description: 'Fast-track problem identification and recovery planning',
    frameworks: ['Five Whys', 'Risk Assessment', 'Action Planning'],
    bestFor: ['Revenue decline', 'Customer churn', 'Operational crises'],
    available: false,
  },
  {
    type: 'growth_strategy',
    name: 'Growth Strategy',
    description: 'Comprehensive growth planning with market and financial analysis',
    frameworks: ['Market Opportunity', 'Financial Modeling', 'Growth Roadmap'],
    bestFor: ['Scaling operations', 'Fundraising', 'Strategic partnerships'],
    available: false,
  },
];

export default function JourneySelectionPage() {
  const [, params] = useRoute("/strategic-consultant/journey-selection/:understandingId");
  const understandingId = params?.understandingId;
  const [, setLocation] = useLocation();
  const { toast} = useToast();
  const [executingJourney, setExecutingJourney] = useState<string | null>(null);

  // Debug: Log params to understand routing issue
  console.log('[JourneySelection] URL params:', params);
  console.log('[JourneySelection] understandingId:', understandingId);

  // If no understandingId, show error state
  if (!understandingId) {
    return (
      <AppLayout
        title="Select Your Journey"
        subtitle="Choose the strategic analysis approach that fits your challenge"
        onViewChange={() => setLocation('/')}
      >
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error: No understanding ID found in URL. Please start a new analysis.</p>
        </div>
      </AppLayout>
    );
  }

  // Fetch understanding data
  const { data: understanding, isLoading } = useQuery({
    queryKey: ['/api/strategic-consultant/understanding', understandingId],
    queryFn: async () => {
      const res = await fetch(`/api/strategic-consultant/understanding/${understandingId}`);
      if (!res.ok) throw new Error('Failed to fetch understanding');
      return res.json();
    },
    enabled: !!understandingId,
  });

  const handleJourneySelect = async (journeyType: string) => {
    // Ensure understandingId is available
    if (!understandingId) {
      toast({
        title: "Error",
        description: "Understanding ID not found. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!JOURNEYS.find(j => j.type === journeyType)?.available) {
      toast({
        title: "Journey not available",
        description: "This journey is coming soon. Try Business Model Innovation for now.",
        variant: "destructive",
      });
      return;
    }

    setExecutingJourney(journeyType);

    try {
      const payload = {
        journeyType,
        understandingId,
      };
      
      console.log('[JourneySelection] Executing journey:', payload);

      const response = await fetch('/api/strategic-consultant/journeys/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Journey execution failed');
      }

      const result = await response.json();
      
      // Store journey type and version number in localStorage for downstream pages
      localStorage.setItem(`journey-type-${result.sessionId}`, journeyType);
      if (result.versionNumber) {
        // Store by BOTH sessionId formats so all downstream requests can find it
        localStorage.setItem(`journey-version-${result.sessionId}`, String(result.versionNumber));
        if (result.journeySessionId) {
          localStorage.setItem(`journey-version-${result.journeySessionId}`, String(result.versionNumber));
        }
        console.log(`[JourneySelection] Stored version ${result.versionNumber} for both sessionId formats`);
      }

      // Invalidate session context cache so it shows the new journey data
      queryClient.invalidateQueries({ queryKey: ["/api/session-context"] });

      toast({
        title: "Journey started!",
        description: `${result.message}`,
      });

      // Navigate to first page in the journey
      setTimeout(() => {
        setLocation(result.navigationUrl);
      }, 500);

    } catch (error: any) {
      toast({
        title: "Journey execution failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExecutingJourney(null);
    }
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Select Your Journey"
        subtitle="Choose the strategic analysis approach that fits your challenge"
        onViewChange={() => setLocation('/')}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Select Your Journey"
      subtitle="Choose the strategic analysis approach that fits your challenge"
      onViewChange={() => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* User Input Summary */}
        {understanding?.userInput && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Your Challenge</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {understanding.userInput}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Journey Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {JOURNEYS.map((journey) => (
            <Card
              key={journey.type}
              className={`relative transition-all ${
                journey.available 
                  ? 'hover:shadow-lg cursor-pointer border-primary/20' 
                  : 'opacity-60'
              }`}
              data-testid={`journey-card-${journey.type.toLowerCase()}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{journey.name}</CardTitle>
                  {journey.available ? (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2">
                      <Clock className="h-3 w-3 mr-1" />
                      Soon
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-2">
                  {journey.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Frameworks */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Frameworks:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {journey.frameworks.map((fw, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {fw}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Best For */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Best for:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {journey.bestFor.map((item, idx) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => handleJourneySelect(journey.type)}
                  disabled={!journey.available || executingJourney !== null}
                  className="w-full mt-4"
                  data-testid={`button-select-journey-${journey.type.toLowerCase()}`}
                >
                  {executingJourney === journey.type ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      Start Journey
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Help Text */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              💡 Not sure which journey to choose? <strong>Business Model Innovation</strong> is a great starting point for most challenges.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
