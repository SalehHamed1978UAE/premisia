import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, Star, Sparkles, ArrowRight, Play, Edit2, Trash2, Puzzle, AlertCircle } from 'lucide-react';
import { JourneyBuilderWizard } from './JourneyBuilderWizard';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Journey {
  type: string;
  name: string;
  description: string;
  frameworks: string[];
  estimatedDuration: string;
  available: boolean;
  summaryBuilder?: string;
}

interface CustomJourneyConfig {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  nodes: Array<{ id: string; moduleId: string; position: { x: number; y: number }; config?: Record<string, unknown> }>;
  edges: Array<{ id: string; sourceNodeId: string; sourcePortId: string; targetNodeId: string; targetPortId: string }>;
  estimatedDurationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

interface JourneyTemplate {
  id: string;
  name: string;
  description: string | null;
  steps: Array<{ frameworkKey: string; name: string; estimatedDuration?: number }>;
  tags: string[];
  estimatedDuration: number | null;
  createdAt: string;
}

export function JourneyHub() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showBuilder, setShowBuilder] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [journeyToDelete, setJourneyToDelete] = useState<CustomJourneyConfig | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check for discoveryId from Segment Discovery handoff
  const urlParams = new URLSearchParams(window.location.search);
  const discoveryId = urlParams.get('discoveryId');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['journey-registry'],
    queryFn: async () => {
      const res = await fetch('/api/strategic-consultant/journey-registry');
      if (!res.ok) throw new Error('Failed to fetch journeys');
      const json = await res.json();
      return json.journeys as Journey[];
    },
  });

  const { data: customJourneysData, isLoading: customLoading, refetch: refetchCustom } = useQuery({
    queryKey: ['custom-journey-configs'],
    queryFn: async () => {
      const res = await fetch('/api/custom-journey-builder/configs');
      if (!res.ok) throw new Error('Failed to fetch custom journeys');
      const json = await res.json();
      return json.configs as CustomJourneyConfig[];
    },
  });

  const { data: myTemplatesData, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ['my-journey-templates'],
    queryFn: async () => {
      const res = await fetch('/api/journey-builder/my-templates');
      if (!res.ok) throw new Error('Failed to fetch my templates');
      const json = await res.json();
      return json.templates as JourneyTemplate[];
    },
  });

  const deleteJourneyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/custom-journey-builder/configs/${id}`);
      if (!res.ok) throw new Error('Failed to delete journey');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-journey-configs'] });
      toast({ title: 'Journey deleted', description: 'Your custom journey has been removed.' });
      setDeleteDialogOpen(false);
      setJourneyToDelete(null);
    },
    onError: () => {
      toast({ title: 'Delete failed', description: 'Could not delete the journey. Please try again.', variant: 'destructive' });
    },
  });

  const journeys = data || [];
  const customJourneys = customJourneysData || [];
  const myTemplates = myTemplatesData || [];

  // Separate available from coming soon
  const availableJourneys = journeys.filter(j => j.available);
  const comingSoonJourneys = journeys.filter(j => !j.available);

  const startJourney = (journeyType: string) => {
    const params = discoveryId ? `?discoveryId=${discoveryId}` : '';
    setLocation(`/strategic-consultant${params}`);
  };

  const startTemplateJourney = (templateId: string) => {
    const params = new URLSearchParams();
    if (discoveryId) params.set('discoveryId', discoveryId);
    params.set('templateId', templateId);
    const queryString = params.toString();
    setLocation(`/strategic-consultant${queryString ? '?' + queryString : ''}`);
  };

  const runCustomJourney = (journeyId: string) => {
    setLocation(`/journey-builder/${journeyId}/run`);
  };

  const editCustomJourney = (journeyId: string) => {
    setLocation(`/journey-builder/${journeyId}`);
  };

  const confirmDeleteJourney = (journey: CustomJourneyConfig) => {
    setJourneyToDelete(journey);
    setDeleteDialogOpen(true);
  };

  const getModuleNames = (nodes: CustomJourneyConfig['nodes']) => {
    return nodes.map(n => n.moduleId.replace(/-/g, ' ').replace(/analyzer|generator/gi, '').trim());
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Varies';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.round(minutes / 60)} hr`;
  };

  if (isLoading || customLoading || templatesLoading) {
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

      {/* My Custom Journeys */}
      {customJourneys.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl md:text-2xl font-semibold mb-4 flex items-center gap-2">
            <Puzzle className="w-6 h-6 text-purple-500" />
            My Custom Journeys
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customJourneys.map(journey => (
              <Card 
                key={journey.id} 
                className="hover:shadow-lg transition-shadow border-2 hover:border-purple-500"
                data-testid={`card-custom-journey-${journey.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl">{journey.name}</CardTitle>
                    <Badge 
                      variant={journey.status === 'published' ? 'default' : 'outline'}
                      className={journey.status === 'published' ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-300 text-purple-700 bg-purple-50'}
                    >
                      {journey.status === 'draft' ? 'Draft' : journey.status === 'published' ? 'Published' : 'Archived'}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 min-h-[3rem]">
                    {journey.description || 'No description provided'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(journey.estimatedDurationMinutes)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Puzzle className="w-4 h-4" />
                      {journey.nodes.length} modules
                    </div>
                  </div>
                  <div className="mb-4 min-h-[4rem]">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Modules:</p>
                    <div className="flex flex-wrap gap-1">
                      {getModuleNames(journey.nodes).slice(0, 4).map((name, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs capitalize">
                          {name}
                        </Badge>
                      ))}
                      {journey.nodes.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{journey.nodes.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 pt-0">
                  <Button 
                    onClick={() => runCustomJourney(journey.id)}
                    className="flex-1 gap-1"
                    size="sm"
                    disabled={journey.nodes.length === 0}
                    data-testid={`button-run-custom-${journey.id}`}
                  >
                    <Play className="w-4 h-4" />
                    Run
                  </Button>
                  <Button 
                    onClick={() => editCustomJourney(journey.id)}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    data-testid={`button-edit-custom-${journey.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button 
                    onClick={() => confirmDeleteJourney(journey)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`button-delete-custom-${journey.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* My Templates (from Journey Builder Wizard) */}
      {myTemplates.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl md:text-2xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            My Custom Journeys
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myTemplates.map(template => (
              <Card 
                key={template.id} 
                className="hover:shadow-lg transition-shadow border-2 hover:border-indigo-500"
                data-testid={`card-template-${template.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    <Badge className="bg-indigo-600 hover:bg-indigo-700">
                      Custom
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 min-h-[3rem]">
                    {template.description || 'Custom journey created by you'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(template.estimatedDuration)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Puzzle className="w-4 h-4" />
                      {template.steps.length} steps
                    </div>
                  </div>
                  <div className="mb-4 min-h-[4rem]">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Frameworks:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.steps.slice(0, 4).map((step, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs capitalize">
                          {step.name || step.frameworkKey.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                      {template.steps.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.steps.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={() => startTemplateJourney(template.id)}
                    className="w-full gap-2"
                    disabled={template.steps.length === 0}
                    data-testid={`button-start-template-${template.id}`}
                  >
                    <Play className="w-4 h-4" />
                    Start Journey
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

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
              refetch();
              refetchCustom();
              refetchTemplates();
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-journey">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Delete Custom Journey?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{journeyToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => journeyToDelete && deleteJourneyMutation.mutate(journeyToDelete.id)}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-delete"
              >
                {deleteJourneyMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
