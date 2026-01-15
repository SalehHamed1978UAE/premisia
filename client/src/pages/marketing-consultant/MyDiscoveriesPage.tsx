import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FolderOpen, 
  ChevronRight, 
  Target, 
  Calendar,
  Plus,
  Loader2
} from "lucide-react";

interface Discovery {
  id: string;
  offeringType: string;
  stage: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export default function MyDiscoveriesPage() {
  const [, setLocation] = useLocation();

  const { data: discoveriesData, isLoading } = useQuery<{ discoveries: Discovery[] }>({
    queryKey: ['/api/marketing-consultant/discoveries'],
  });

  const discoveries = discoveriesData?.discoveries || [];
  const completedDiscoveries = discoveries.filter(d => d.status === 'completed');
  const inProgressDiscoveries = discoveries.filter(d => d.status !== 'completed');

  const formatOfferingType = (type: string) => {
    const labels: Record<string, string> = {
      b2b_software: 'B2B Software',
      b2c_software: 'B2C Software',
      professional_services: 'Professional Services',
      physical_product: 'Physical Product',
      marketplace_platform: 'Marketplace',
      content_education: 'Content/Education',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const formatStage = (stage: string) => {
    const labels: Record<string, string> = {
      idea_validation: 'Idea Validation',
      mvp_launched: 'MVP Launched',
      early_revenue: 'Early Revenue',
      growth_stage: 'Growth Stage',
      established: 'Established',
    };
    return labels[stage] || stage;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'discovery_running':
        return <Badge variant="secondary" className="bg-blue-600">In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <FolderOpen className="h-8 w-8 text-primary" />
              My Discoveries
            </h1>
            <p className="text-muted-foreground mt-2">
              View and manage your customer segment discovery results
            </p>
          </div>
          <Button 
            onClick={() => setLocation('/marketing-consultant')}
            data-testid="button-new-discovery"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Discovery
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-9 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : discoveries.length === 0 ? (
          <Card data-testid="card-empty-state">
            <CardContent className="p-12 text-center">
              <Target className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No discoveries yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Start your first segment discovery to identify high-potential customer segments for your offering.
              </p>
              <Button 
                onClick={() => setLocation('/marketing-consultant')}
                data-testid="button-start-first-discovery"
              >
                <Plus className="h-4 w-4 mr-2" />
                Start Your First Discovery
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {inProgressDiscoveries.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  In Progress
                </h2>
                <div className="space-y-3">
                  {inProgressDiscoveries.map((discovery) => (
                    <Card 
                      key={discovery.id} 
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/marketing-consultant/segment-discovery/${discovery.id}`)}
                      data-testid={`card-discovery-${discovery.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Target className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                              <div className="font-medium">
                                {formatOfferingType(discovery.offeringType)}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{formatStage(discovery.stage)}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Started {formatDistanceToNow(new Date(discovery.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(discovery.status)}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {completedDiscoveries.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3" data-testid="text-completed-header">
                  Completed Discoveries ({completedDiscoveries.length})
                </h2>
                <div className="space-y-3">
                  {completedDiscoveries.map((discovery) => (
                    <Card 
                      key={discovery.id} 
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/marketing-consultant/results/${discovery.id}`)}
                      data-testid={`card-discovery-${discovery.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                              <Target className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                              <div className="font-medium">
                                {formatOfferingType(discovery.offeringType)}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{formatStage(discovery.stage)}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {discovery.completedAt 
                                    ? formatDistanceToNow(new Date(discovery.completedAt), { addSuffix: true })
                                    : formatDistanceToNow(new Date(discovery.createdAt), { addSuffix: true })
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(discovery.status)}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
