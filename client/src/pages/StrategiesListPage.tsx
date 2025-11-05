import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Rocket, Calendar, TrendingUp, Archive, Plus, Trash2, CheckSquare, X, Network } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useKnowledgeInsights } from "@/hooks/useKnowledgeInsights";

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
  latestSessionId?: string | null;
}

interface StrategyCardProps {
  strategy: Strategy;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onNavigate: (id: string) => void;
}

function StrategyInsightsBadges({ sessionId }: { sessionId: string | null }) {
  const { knowledgeGraph: knowledgeGraphEnabled } = useFeatureFlags();
  const { data: insightsData } = useKnowledgeInsights(sessionId, {
    enabled: knowledgeGraphEnabled && !!sessionId,
  });

  if (!knowledgeGraphEnabled || !sessionId || !insightsData) {
    return null;
  }

  const similarCount = insightsData.similarStrategies?.length || 0;
  const incentivesCount = insightsData.incentives?.length || 0;

  if (similarCount === 0 && incentivesCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Network className="h-4 w-4 text-muted-foreground" />
      {similarCount > 0 && (
        <Badge variant="secondary" className="text-xs" data-testid="badge-insights-similar">
          {similarCount} similar
        </Badge>
      )}
      {incentivesCount > 0 && (
        <Badge variant="secondary" className="text-xs" data-testid="badge-insights-incentives">
          {incentivesCount} incentive{incentivesCount > 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
}

function StrategyCard({ strategy, selectionMode, isSelected, onToggleSelect, onNavigate }: StrategyCardProps) {
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      e.preventDefault();
      onToggleSelect(strategy.id);
    } else {
      onNavigate(strategy.id);
    }
  };

  return (
    <div onClick={handleCardClick} className="relative">
      <Card className={`hover:shadow-lg transition-shadow cursor-pointer max-w-full ${isSelected ? 'ring-2 ring-primary' : ''}`} data-testid={`card-strategy-${strategy.id}`}>
        {selectionMode && (
          <div className="absolute top-3 left-3 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(strategy.id)}
              data-testid={`checkbox-strategy-${strategy.id}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className={`flex-1 min-w-0 ${selectionMode ? 'pl-8' : ''}`}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
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
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span data-testid={`text-last-updated-${strategy.id}`}>
              Updated {formatDistanceToNow(new Date(strategy.latestJourneyUpdated || strategy.updatedAt), { addSuffix: true })}
            </span>
          </div>
          
          {/* Knowledge Graph Insights */}
          <div className="mt-2">
            <StrategyInsightsBadges sessionId={strategy.latestSessionId || null} />
          </div>
        </CardContent>
      </Card>
    </div>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: strategies, isLoading, error } = useQuery<Strategy[]>({
    queryKey: ['/api/strategies'],
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest('POST', '/api/repository/batch-delete', { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-summary'] });
      toast({
        title: "Strategies deleted",
        description: `Successfully deleted ${selectedIds.length} ${selectedIds.length === 1 ? 'strategy' : 'strategies'} and all related artifacts.`,
      });
      setSelectedIds([]);
      setSelectionMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Deletion failed",
        description: error.message || "Failed to delete strategies. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (!strategies) return;
    setSelectedIds(strategies.map(s => s.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBatchDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    batchDeleteMutation.mutate(selectedIds);
    setShowDeleteDialog(false);
  };

  const handleNavigate = (id: string) => {
    navigate(`/strategies/${id}`);
  };

  return (
    <AppLayout
      showTopBar={true}
      title="Strategies Hub"
      subtitle="Your unified strategic initiatives"
      sidebarOpen={sidebarOpen}
      onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
    >
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 px-6 pt-2 pb-6 space-y-3" data-testid="page-strategies-list">
        {/* Welcome Header with Primary CTA */}
        {!selectionMode && (
          <div className="text-center max-w-4xl mx-auto mb-4">
            <p className="text-lg text-muted-foreground mb-4">
              Your strategic intelligence center—track progress, launch initiatives
            </p>
            <Button
              onClick={() => navigate('/strategic-consultant/input')}
              className="bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:shadow-xl transition-all"
              size="lg"
              data-testid="button-new-strategy-hero"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create New Strategy
            </Button>
          </div>
        )}

        {/* Selection Mode Controls */}
        {selectionMode && (
          <div className="max-w-6xl mx-auto mb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-sm" data-testid="badge-selected-count">
                  {selectedIds.length} selected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={!strategies || selectedIds.length === strategies.length}
                  data-testid="button-select-all"
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  disabled={selectedIds.length === 0}
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                  disabled={selectedIds.length === 0 || batchDeleteMutation.isPending}
                  data-testid="button-batch-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedIds.length})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedIds([]);
                  }}
                  data-testid="button-cancel-selection"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Stats Cards - Mobile Optimized */}
        {strategies && strategies.length > 0 && (
          <div className="max-w-6xl mx-auto grid gap-2 grid-cols-3 md:gap-4 mb-4">
            <Link href="/strategies">
              <Card className="shadow-lg border-primary/20 hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer group">
                <CardContent className="p-3 md:p-5">
                  <div className="flex flex-col md:flex-row items-center md:gap-3 text-center md:text-left">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform mb-2 md:mb-0">
                      <Rocket className="h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] md:text-xs font-medium text-muted-foreground leading-tight">
                        <span className="md:hidden">Total<br />Strategies</span>
                        <span className="hidden md:inline">Total Strategies</span>
                      </p>
                      <p className="text-xl md:text-2xl font-bold text-foreground" data-testid="stat-total-strategies">
                        {strategies.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="shadow-lg border-primary/20 hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer group">
              <CardContent className="p-3 md:p-5">
                <div className="flex flex-col md:flex-row items-center md:gap-3 text-center md:text-left">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform mb-2 md:mb-0">
                    <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] md:text-xs font-medium text-muted-foreground leading-tight">
                      <span className="md:hidden">Active<br />Journeys</span>
                      <span className="hidden md:inline">Active Journeys</span>
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-foreground" data-testid="stat-active-journeys">
                      {strategies.filter(s => s.latestJourneyStatus === 'in_progress').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-primary/20 hover:shadow-xl hover:border-primary/40 transition-all cursor-pointer group">
              <CardContent className="p-3 md:p-5">
                <div className="flex flex-col md:flex-row items-center md:gap-3 text-center md:text-left">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform mb-2 md:mb-0">
                    <Archive className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] md:text-xs font-medium text-muted-foreground leading-tight">
                      <span className="md:hidden">Total<br />Journeys</span>
                      <span className="hidden md:inline">Total Journeys</span>
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-foreground" data-testid="stat-total-journeys">
                      {strategies.reduce((sum, s) => sum + Number(s.journeyCount), 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions Bar */}
        {strategies && strategies.length > 0 && !selectionMode && (
          <div className="max-w-6xl mx-auto flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your Strategies</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
              data-testid="button-enable-selection"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Manage
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="max-w-6xl mx-auto">
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
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.includes(strategy.id)}
                  onToggleSelect={handleToggleSelect}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-confirm-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} {selectedIds.length === 1 ? 'Strategy' : 'Strategies'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected {selectedIds.length === 1 ? 'strategy' : 'strategies'} and all related artifacts including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Strategy versions and analyses</li>
                <li>EPM programs generated from {selectedIds.length === 1 ? 'this strategy' : 'these strategies'}</li>
                <li>Journey sessions and research data</li>
                <li>All associated references and insights</li>
              </ul>
              <p className="mt-2 font-semibold">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
