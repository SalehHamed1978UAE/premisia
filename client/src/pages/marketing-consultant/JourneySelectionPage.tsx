import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Clock, ArrowRight, Target, Crosshair, BarChart3 } from "lucide-react";

interface BetaStatus {
  available: boolean;
  currentCount: number;
  maxCount: number;
}

interface UnderstandingData {
  id: string;
  offeringDescription: string;
  offeringType: string;
  stage: string;
  gtmConstraint: string;
  salesMotion: string;
  existingHypothesis: string | null;
  clarifications: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const MARKETING_JOURNEYS = [
  {
    id: "segment_discovery",
    title: "Segment Discovery",
    description: "Identify your ideal customer segments using an 8-dimension gene library approach",
    icon: Target,
    available: true,
    isBeta: true,
  },
  {
    id: "positioning_research",
    title: "Positioning Research",
    description: "Define your unique market position and messaging strategy",
    icon: Crosshair,
    available: false,
    isBeta: false,
  },
  {
    id: "competitive_analysis",
    title: "Competitive Analysis",
    description: "Analyze your competitive landscape and identify opportunities",
    icon: BarChart3,
    available: false,
    isBeta: false,
  },
];

export default function MarketingJourneySelectionPage() {
  const [, params] = useRoute("/marketing-consultant/journey-selection/:understandingId");
  const understandingId = params?.understandingId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [startingJourney, setStartingJourney] = useState<string | null>(null);

  const { data: betaStatus, isLoading: loadingBetaStatus } = useQuery<BetaStatus>({
    queryKey: ['/api/marketing-consultant/beta-status'],
    enabled: !!understandingId,
  });

  const { data: understandingData, isLoading: loadingUnderstanding } = useQuery<UnderstandingData>({
    queryKey: ['/api/marketing-consultant', understandingId],
    enabled: !!understandingId,
  });

  const seatsRemaining = betaStatus ? betaStatus.maxCount - betaStatus.currentCount : 50;
  const isLoading = loadingBetaStatus || loadingUnderstanding;

  if (!understandingId) {
    return (
      <AppLayout
        title="Select Your Marketing Journey"
        subtitle="Choose the marketing analysis approach that fits your needs"
      >
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive" data-testid="error-no-understanding-id">
            Error: No understanding ID found in URL. Please start a new analysis.
          </p>
        </div>
      </AppLayout>
    );
  }

  const handleJourneySelect = async (journeyId: string) => {
    const journey = MARKETING_JOURNEYS.find((j) => j.id === journeyId);
    
    if (!journey?.available) {
      toast({
        title: "Coming Soon",
        description: "This journey is not yet available. Check back soon!",
      });
      return;
    }

    setStartingJourney(journeyId);

    try {
      const response = await fetch('/api/marketing-consultant/beta/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to check beta availability');
      }

      const result = await response.json();

      if (!result.available) {
        toast({
          title: "Beta limit reached",
          description: "Beta limit reached - join waitlist",
          variant: "destructive",
        });
        setStartingJourney(null);
        return;
      }

      setLocation(`/marketing-consultant/segment-discovery/${understandingId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start journey",
        variant: "destructive",
      });
      setStartingJourney(null);
    }
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Select Your Marketing Journey"
        subtitle="Choose the marketing analysis approach that fits your needs"
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Select Your Marketing Journey"
      subtitle="Choose the marketing analysis approach that fits your needs"
    >
      <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-0">
        {understandingData?.offeringDescription && (
          <Card className="bg-muted/50">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg">Your Offering</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-sm text-muted-foreground line-clamp-3 break-words" data-testid="text-offering-description">
                {understandingData.offeringDescription}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" data-testid="journey-grid">
          {MARKETING_JOURNEYS.map((journey) => {
            const IconComponent = journey.icon;
            return (
              <Card
                key={journey.id}
                className={`relative transition-all ${
                  journey.available
                    ? 'hover:shadow-xl hover:border-primary hover:scale-[1.02] border-2 cursor-pointer'
                    : 'opacity-60'
                }`}
                data-testid={`card-journey-${journey.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${journey.available ? 'bg-primary/10' : 'bg-muted'}`}>
                        <IconComponent className={`h-5 w-5 ${journey.available ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <CardTitle className="text-lg">{journey.title}</CardTitle>
                    </div>
                    {journey.available ? (
                      journey.isBeta ? (
                        <Badge variant="secondary" className="ml-2" data-testid={`badge-beta-${journey.id}`}>
                          {seatsRemaining} seats remaining
                        </Badge>
                      ) : (
                        <Badge variant="default" className="ml-2">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Available
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="ml-2" data-testid={`badge-coming-soon-${journey.id}`}>
                        <Clock className="h-3 w-3 mr-1" />
                        Coming Soon
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-3">
                    {journey.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleJourneySelect(journey.id)}
                    disabled={!journey.available || startingJourney !== null}
                    size="lg"
                    className="w-full font-semibold text-base shadow-md hover:shadow-lg"
                    data-testid={`button-start-${journey.id}`}
                  >
                    {startingJourney === journey.id ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : journey.available ? (
                      <>
                        Start Journey
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    ) : (
                      'Coming Soon'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-dashed">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              💡 <strong>Segment Discovery</strong> helps you identify your ideal customer segments using research-backed methodologies.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
