import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, Star, Sparkles, ArrowRight } from 'lucide-react';
import { JourneyBuilderWizard } from './JourneyBuilderWizard';
import { AppLayout } from '@/components/layout/AppLayout';

interface Journey {
  type: string;
  name: string;
  description: string;
  frameworks: string[];
  estimatedDuration: string;
  available: boolean;
  summaryBuilder?: string;
}

export function JourneyHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showBuilder, setShowBuilder] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['journey-registry'],
    queryFn: async () => {
      const res = await fetch('/api/strategic-consultant/journey-registry');
      if (!res.ok) throw new Error('Failed to fetch journeys');
      const json = await res.json();
      return json.journeys as Journey[];
    },
  });

  const journeys = data || [];

  // Separate available from coming soon
  const availableJourneys = journeys.filter(j => j.available);
  const comingSoonJourneys = journeys.filter(j => !j.available);

  const startJourney = (journeyType: string) => {
    // Navigate to strategic consultant page
    // This is the primary entry point for all strategic journeys
    // User will proceed through: Input → Journey Selection → Analysis
    setLocation(`/strategic-consultant`);
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Strategic Journeys"
        subtitle="Choose a pre-defined journey or create your own custom path"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading journeys...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Strategic Journeys"
      subtitle="Choose a pre-defined journey or create your own custom path"
    >
      <div className="container mx-auto p-6 max-w-7xl" data-testid="journey-hub">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Strategic Journeys</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Choose a pre-defined journey or create your own custom path
            </p>
          </div>
          <Button 
            onClick={() => setShowBuilder(true)}
            size="default"
            className="gap-2 bg-purple-600 hover:bg-purple-700 shrink-0 text-sm md:text-base px-3 md:px-4"
            data-testid="button-create-custom-journey"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">Create Custom Journey</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>
      </div>

      {/* Available Journeys */}
      <section className="mb-12">
        <h2 className="text-xl md:text-2xl font-semibold mb-4 flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500" />
          Available Journeys
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableJourneys.map(journey => (
            <Card 
              key={journey.type} 
              className="hover:shadow-lg transition-shadow border-2 hover:border-primary"
              data-testid={`card-journey-${journey.type}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-xl">{journey.name}</CardTitle>
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    Available
                  </Badge>
                </div>
                <CardDescription className="mt-2 min-h-[3rem]">
                  {journey.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {journey.estimatedDuration}
                  </div>
                </div>
                <div className="mb-4 min-h-[4rem]">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Frameworks:</p>
                  <div className="flex flex-wrap gap-1">
                    {journey.frameworks.map((fw, idx) => (
                      <div key={fw} className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {fw.replace(/_/g, ' ')}
                        </Badge>
                        {idx < journey.frameworks.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <Button 
                  onClick={() => startJourney(journey.type)}
                  className="w-full gap-2"
                  data-testid={`button-start-${journey.type}`}
                >
                  Start Journey
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Coming Soon Journeys */}
      {comingSoonJourneys.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl md:text-2xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            Coming Soon
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comingSoonJourneys.map(journey => (
              <Card 
                key={journey.type} 
                className="opacity-60 border-2 border-dashed"
                data-testid={`card-journey-${journey.type}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl">{journey.name}</CardTitle>
                    <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
                      Coming Soon
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 min-h-[3rem]">
                    {journey.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {journey.estimatedDuration}
                    </div>
                  </div>
                  <div className="mb-4 min-h-[4rem]">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Frameworks:</p>
                    <div className="flex flex-wrap gap-1">
                      {journey.frameworks.map((fw, idx) => (
                        <div key={fw} className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {fw.replace(/_/g, ' ')}
                          </Badge>
                          {idx < journey.frameworks.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button 
                    disabled
                    className="w-full gap-2"
                    data-testid={`button-start-${journey.type}`}
                  >
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!isLoading && journeys.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            No journeys available. Something went wrong loading the journeys.
          </div>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      )}

        {/* Journey Builder Wizard Modal */}
        {showBuilder && (
          <JourneyBuilderWizard 
            onClose={() => setShowBuilder(false)}
            onSave={() => {
              setShowBuilder(false);
              refetch(); // Refresh templates to show new custom journey
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
