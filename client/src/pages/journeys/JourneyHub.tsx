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

interface JourneyTemplate {
  id: string;
  name: string;
  description: string;
  isSystemTemplate: boolean;
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  usageCount: number;
  category: string;
  tags: string[];
  steps: Array<{ id: string; name: string; frameworkKey: string }>;
}

export function JourneyHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showBuilder, setShowBuilder] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['journey-templates'],
    queryFn: async () => {
      const res = await fetch('/api/journey-builder/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const json = await res.json();
      return json.templates as JourneyTemplate[];
    },
  });

  const templates = data || [];

  // Separate system templates from custom
  const systemTemplates = templates.filter(t => t.isSystemTemplate);
  const customTemplates = templates.filter(t => !t.isSystemTemplate);

  const startJourney = async (templateId: string) => {
    try {
      const res = await fetch('/api/journey-builder/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });

      if (!res.ok) throw new Error('Failed to start journey');
      const { sessionId } = await res.json();

      // Navigate to strategic consultant with journey session
      window.location.href = `/strategic-consultant?journeySession=${sessionId}`;
    } catch (error) {
      console.error('Error starting journey:', error);
      alert('Failed to start journey. Please try again.');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Strategic Journeys"
        subtitle="Choose a pre-defined journey or create your own custom path"
        onViewChange={(view) => setLocation('/')}
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
      onViewChange={(view) => setLocation('/')}
    >
      <div className="container mx-auto p-6 max-w-7xl" data-testid="journey-hub">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Strategic Journeys</h1>
          <p className="text-muted-foreground">
            Choose a pre-defined journey or create your own custom path
          </p>
        </div>
        <Button 
          onClick={() => setShowBuilder(true)}
          size="lg"
          className="gap-2 bg-purple-600 hover:bg-purple-700"
          data-testid="button-create-custom-journey"
        >
          <Plus className="w-5 h-5" />
          Create Custom Journey
        </Button>
      </div>

      {/* Pre-defined Journeys */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500" />
          Pre-defined Journeys
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {systemTemplates.map(template => (
            <Card 
              key={template.id} 
              className="hover:shadow-lg transition-shadow border-2 hover:border-indigo-200"
              data-testid={`card-system-template-${template.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-xl">{template.name}</CardTitle>
                  <Badge 
                    variant="outline" 
                    className={getDifficultyColor(template.difficulty)}
                  >
                    {template.difficulty}
                  </Badge>
                </div>
                <CardDescription className="mt-2 min-h-[3rem]">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    ~{template.estimatedDuration} min
                  </div>
                  <div>
                    {template.usageCount} {template.usageCount === 1 ? 'use' : 'uses'}
                  </div>
                </div>
                <div className="mb-4 min-h-[4rem]">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Framework Sequence:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.steps?.map((step: any, idx: number) => (
                      <div key={step.id} className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {step.name}
                        </Badge>
                        {idx < template.steps.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <Button 
                  onClick={() => startJourney(template.id)}
                  className="w-full gap-2"
                  data-testid={`button-start-${template.id}`}
                >
                  Start Journey
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Custom Journeys */}
      {customTemplates.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            Your Custom Journeys
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customTemplates.map(template => (
              <Card 
                key={template.id} 
                className="hover:shadow-lg transition-shadow border-2 border-purple-200 bg-purple-50/30"
                data-testid={`card-custom-template-${template.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    <Badge className="bg-purple-600 hover:bg-purple-700">
                      Custom
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 min-h-[3rem]">
                    {template.description || 'Your custom journey'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      ~{template.estimatedDuration} min
                    </div>
                  </div>
                  <div className="mb-4 min-h-[4rem]">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Framework Sequence:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.steps?.map((step: any, idx: number) => (
                        <div key={step.id} className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {step.name}
                          </Badge>
                          {idx < template.steps.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button 
                    onClick={() => startJourney(template.id)}
                    className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                    data-testid={`button-start-custom-${template.id}`}
                  >
                    Start Journey
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!isLoading && templates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            No journeys available. Something went wrong loading the templates.
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
