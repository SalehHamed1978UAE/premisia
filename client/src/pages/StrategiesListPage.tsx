import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Calendar, TrendingUp, Archive, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Strategy {
  id: string;
  title: string | null;
  initiativeType: string | null;
  initiativeDescription: string | null;
  strategyMetadata: any;
  createdAt: Date;
  updatedAt: Date;
  journeyCount: number;
  latestJourneyStatus: string | null;
  latestJourneyUpdated: Date | null;
}

function StrategyCard({ strategy }: { strategy: Strategy }) {
  const displayTitle = strategy.title || strategy.initiativeDescription || "Untitled Strategy";
  
  // Get readiness info from metadata
  const metadata = strategy.strategyMetadata || {};
  const confidence = metadata.confidence || 0;
  const availableFrameworks = (metadata.completedFrameworks || []).length;
  const availableReferences = metadata.availableReferences || 0;
  
  const statusColor = {
    'initializing': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'in_progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'failed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }[strategy.latestJourneyStatus || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';

  return (
    <Link href={`/strategies/${strategy.id}`} data-testid={`card-strategy-${strategy.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer max-w-full">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-xl mb-2 break-words" data-testid={`text-strategy-title-${strategy.id}`}>
                {displayTitle}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                {strategy.initiativeType && (
                  <Badge variant="outline" className="capitalize text-xs" data-testid={`badge-initiative-type-${strategy.id}`}>
                    {strategy.initiativeType.replace(/_/g, ' ')}
                  </Badge>
                )}
                {strategy.latestJourneyStatus && (
                  <Badge className={`${statusColor} text-xs`} data-testid={`badge-status-${strategy.id}`}>
                    {strategy.latestJourneyStatus.replace(/_/g, ' ')}
                  </Badge>
                )}
              </CardDescription>
            </div>
            <Rocket className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground flex-shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Journeys</p>
              <p className="font-semibold" data-testid={`text-journey-count-${strategy.id}`}>
                {strategy.journeyCount}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Frameworks</p>
              <p className="font-semibold" data-testid={`text-framework-count-${strategy.id}`}>
                {availableFrameworks}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">References</p>
              <p className="font-semibold" data-testid={`text-reference-count-${strategy.id}`}>
                {availableReferences}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Confidence</p>
              <p className="font-semibold" data-testid={`text-confidence-${strategy.id}`}>
                {confidence > 0 ? `${(confidence * 100).toFixed(0)}%` : 'N/A'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span data-testid={`text-last-updated-${strategy.id}`}>
              Updated {formatDistanceToNow(new Date(strategy.latestJourneyUpdated || strategy.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StrategyListSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function StrategiesListPage() {
  const { data: strategies, isLoading, error } = useQuery<Strategy[]>({
    queryKey: ['/api/strategies'],
  });

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8" data-testid="page-strategies-list">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words" data-testid="heading-strategies">
              Strategies Hub
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              Your unified strategic initiatives with full research provenance
            </p>
          </div>
          <Link href="/strategic-consultant/input" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto" data-testid="button-new-strategy">
              <Plus className="h-4 w-4 mr-2" />
              New Strategy
            </Button>
          </Link>
        </div>
        
        {/* Stats Summary */}
        {strategies && strategies.length > 0 && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Strategies</CardDescription>
                <CardTitle className="text-3xl" data-testid="stat-total-strategies">
                  {strategies.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Active Journeys</CardDescription>
                <CardTitle className="text-3xl" data-testid="stat-active-journeys">
                  {strategies.filter(s => s.latestJourneyStatus === 'in_progress').length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Journeys</CardDescription>
                <CardTitle className="text-3xl" data-testid="stat-total-journeys">
                  {strategies.reduce((sum, s) => sum + Number(s.journeyCount), 0)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <StrategyListSkeleton />
      ) : error ? (
        <Card className="p-8 text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Failed to load strategies</h3>
          <p className="text-muted-foreground">Please try again later.</p>
        </Card>
      ) : !strategies || strategies.length === 0 ? (
        <Card className="p-8 text-center">
          <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No strategies yet</h3>
          <p className="text-muted-foreground mb-4">
            Start your first strategic analysis to see it here
          </p>
          <Link href="/strategic-consultant/input">
            <Button data-testid="button-get-started">
              <Plus className="h-4 w-4 mr-2" />
              Get Started
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {strategies.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>
      )}
    </div>
  );
}
