import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Archive, Calendar, TrendingUp, FileText, AlertTriangle, Trash2, ArchiveIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { StatementSummary } from '@/types/repository';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function RepositoryBrowser() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: statements, isLoading, error } = useQuery<StatementSummary[]>({
    queryKey: ['/api/repository/statements'],
  });

  const handleArchive = async (e: React.MouseEvent, understandingId: string) => {
    e.stopPropagation();
    toast({
      title: 'Archive feature',
      description: 'Archive functionality coming soon',
    });
  };

  const handleDelete = async (e: React.MouseEvent, understandingId: string) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this statement and all its analyses? This cannot be undone.')) {
      return;
    }

    try {
      await apiRequest('DELETE', `/api/repository/statements/${understandingId}`);
      
      toast({
        title: 'Statement deleted',
        description: 'The statement and all its analyses have been permanently deleted',
      });

      await queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
    } catch (error) {
      console.error('Error deleting statement:', error);
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Could not delete statement',
        variant: 'destructive',
      });
    }
  };

  const getFrameworkBadgeColor = (framework: string) => {
    const colors: Record<string, string> = {
      PESTLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      BMC: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Five Whys': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      "Porter's": 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return colors[framework] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getFrameworkIcon = (framework: string) => {
    if (framework === 'PESTLE') return '🌍';
    if (framework === 'BMC') return '📊';
    if (framework === 'Five Whys') return '❓';
    if (framework === "Porter's") return '🎯';
    return '📋';
  };

  return (
    <AppLayout
      title="Analysis Repository"
      subtitle="Browse all strategic analyses and statements"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3" data-testid="page-title">
              <Archive className="h-8 w-8 text-primary" />
              Analysis Repository
            </h1>
            <p className="text-muted-foreground mt-2">
              {statements?.length || 0} strategic statements with analyses
            </p>
          </div>
        </div>

        {error ? (
          <Card className="p-12 text-center border-destructive">
            <div className="flex flex-col items-center gap-4">
              <AlertTriangle className="h-16 w-16 text-destructive" />
              <div>
                <h3 className="text-xl font-semibold text-foreground">Failed to load analyses</h3>
                <p className="text-muted-foreground mt-2">
                  {error instanceof Error ? error.message : 'An unexpected error occurred'}
                </p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4"
                data-testid="button-retry"
              >
                Retry
              </Button>
            </div>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : statements && statements.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statements.map((statement) => (
              <Card
                key={statement.understandingId}
                className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/50"
                onClick={() => setLocation(`/repository/${statement.understandingId}`)}
                data-testid={`statement-card-${statement.understandingId}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-2" data-testid={`statement-title-${statement.understandingId}`}>
                        {statement.title || statement.statement}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(statement.createdAt), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleArchive(e, statement.understandingId)}
                        data-testid={`button-archive-${statement.understandingId}`}
                        title="Archive statement"
                      >
                        <ArchiveIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleDelete(e, statement.understandingId)}
                        data-testid={`button-delete-${statement.understandingId}`}
                        title="Delete statement"
                      >
                        <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Analysis badges */}
                  {statement.totalAnalyses > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(statement.analyses).map(([framework, info]) => (
                        <Badge
                          key={framework}
                          variant="secondary"
                          className={getFrameworkBadgeColor(framework)}
                          data-testid={`badge-${framework}-${statement.understandingId}`}
                        >
                          <span className="mr-1">{getFrameworkIcon(framework)}</span>
                          {framework} {info.count > 1 ? `(${info.count})` : ''}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      No analyses yet
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span data-testid={`total-analyses-${statement.understandingId}`}>
                        {statement.totalAnalyses} {statement.totalAnalyses === 1 ? 'analysis' : 'analyses'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/repository/${statement.understandingId}`);
                      }}
                      data-testid={`button-view-${statement.understandingId}`}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold text-foreground">No analyses yet</h3>
                <p className="text-muted-foreground mt-2">
                  Start by creating your first strategic analysis
                </p>
              </div>
              <Button
                onClick={() => setLocation('/strategic-consultant/input')}
                className="mt-4"
                data-testid="button-create-first"
              >
                Create Analysis
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
