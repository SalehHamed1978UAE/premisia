import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function JourneySelectionPage() {
  const [, params] = useRoute("/strategic-consultant/journey-selection/:understandingId");
  const understandingId = params?.understandingId;
  const [, setLocation] = useLocation();
  const { toast} = useToast();
  const [executingJourney, setExecutingJourney] = useState<string | null>(null);
  const autoStarted = useRef(false);
  
  // Get journeyType from URL if pre-selected from JourneyHub
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedJourneyType = urlParams.get('journeyType');

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
  const { data: understanding, isLoading: loadingUnderstanding } = useQuery({
    queryKey: ['/api/strategic-consultant/understanding', understandingId],
    queryFn: async () => {
      const res = await fetch(`/api/strategic-consultant/understanding/${understandingId}`);
      if (!res.ok) throw new Error('Failed to fetch understanding');
      return res.json();
    },
    enabled: !!understandingId,
  });

  // Fetch available journeys from registry
  const { data: journeyData, isLoading: loadingJourneys } = useQuery<{ journeys: any[] }>({
    queryKey: ['/api/strategic-consultant/journey-registry'],
    enabled: !!understandingId,
  });

  const journeys = journeyData?.journeys || [];
  const isLoading = loadingUnderstanding || loadingJourneys;

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

    const journey = journeys.find((j: any) => j.type === journeyType);
    if (!journey?.available) {
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

  // Auto-start journey if preselected from JourneyHub
  useEffect(() => {
    if (
      preselectedJourneyType && 
      !isLoading && 
      journeys.length > 0 && 
      !autoStarted.current &&
      !executingJourney
    ) {
      const journey = journeys.find((j: any) => j.type === preselectedJourneyType);
      if (journey?.available) {
        console.log('[JourneySelection] Auto-starting preselected journey:', preselectedJourneyType);
        autoStarted.current = true;
        handleJourneySelect(preselectedJourneyType);
      } else {
        console.log('[JourneySelection] Preselected journey not available:', preselectedJourneyType);
      }
    }
  }, [preselectedJourneyType, isLoading, journeys, executingJourney]);

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
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-0">
        {/* User Input Summary */}
        {understanding?.userInput && (
          <Card className="bg-muted/50">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg">Your Challenge</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <p className="text-sm text-muted-foreground line-clamp-3 break-words">
                {understanding.userInput}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Journey Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {journeys.map((journey: any) => (
            <Card
              key={journey.type}
              className={`relative transition-all ${
                journey.available 
                  ? 'hover:shadow-xl hover:border-primary hover:scale-[1.02] border-2' 
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
                    {journey.frameworks?.map((fw: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {fw}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Estimated Duration */}
                {journey.estimatedDuration && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      Duration: <span className="font-normal">{journey.estimatedDuration}</span>
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  onClick={() => handleJourneySelect(journey.type)}
                  disabled={!journey.available || executingJourney !== null}
                  size="lg"
                  className="w-full mt-4 font-semibold text-base shadow-md hover:shadow-lg"
                  data-testid={`button-select-journey-${journey.type.toLowerCase()}`}
                >
                  {executingJourney === journey.type ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Starting Journey...
                    </>
                  ) : (
                    <>
                      Start Journey
                      <ArrowRight className="h-5 w-5 ml-2" />
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
