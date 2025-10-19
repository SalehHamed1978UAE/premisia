import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Calendar, Clock, TrendingUp, FileText, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { StatementDetail } from '@/types/repository';

export default function StatementDetailView() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/repository/:understandingId');
  const understandingId = params?.understandingId;

  const { data: statement, isLoading, error } = useQuery<StatementDetail>({
    queryKey: [`/api/repository/statements/${understandingId}`],
    enabled: !!understandingId,
  });

  const getFrameworkColor = (framework: string) => {
    const colors: Record<string, string> = {
      PESTLE: 'text-blue-600 dark:text-blue-400',
      BMC: 'text-green-600 dark:text-green-400',
      'Five Whys': 'text-purple-600 dark:text-purple-400',
      "Porter's": 'text-orange-600 dark:text-orange-400',
    };
    return colors[framework] || 'text-gray-600 dark:text-gray-400';
  };

  const getFrameworkIcon = (framework: string) => {
    if (framework === 'PESTLE') return '🌍';
    if (framework === 'BMC') return '📊';
    if (framework === 'Five Whys') return '❓';
    if (framework === "Porter's") return '🎯';
    return '📋';
  };

  const handleViewFullReport = (framework: string, sessionId: string) => {
    if (framework === 'PESTLE') {
      setLocation(`/strategic-consultant/trend-analysis/${sessionId}/1`);
    }
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Loading..."
        subtitle="Fetching statement details"
        onViewChange={(view) => setLocation('/')}
      >
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  // Check for 404 specifically - error format is "404: message" from queryClient
  const is404 = error && (error as any)?.message?.startsWith('404');

  if (error && !is404) {
    return (
      <AppLayout
        title="Error"
        subtitle="Failed to load statement"
        onViewChange={(view) => setLocation('/')}
      >
        <div className="max-w-6xl mx-auto p-6">
          <Alert variant="destructive">
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load statement details. Please try again.'}
            </AlertDescription>
          </Alert>
          <div className="flex gap-4 mt-4">
            <Button onClick={() => window.location.reload()} data-testid="button-retry">
              Retry
            </Button>
            <Button onClick={() => setLocation('/repository')} variant="outline" data-testid="button-back">
              Back to Repository
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!statement || is404) {
    return (
      <AppLayout
        title="Not Found"
        subtitle="Statement not found"
        onViewChange={(view) => setLocation('/')}
      >
        <div className="max-w-6xl mx-auto p-6">
          <Alert variant="destructive">
            <AlertDescription>
              The requested statement could not be found.
            </AlertDescription>
          </Alert>
          <Button onClick={() => setLocation('/repository')} className="mt-4" data-testid="button-back-404">
            Back to Repository
          </Button>
        </div>
      </AppLayout>
    );
  }

  const frameworks = Object.keys(statement.analyses);
  const hasAnalyses = frameworks.length > 0;

  return (
    <AppLayout
      title="Statement Analysis"
      subtitle="View all analyses for this strategic question"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Button
              variant="ghost"
              onClick={() => setLocation('/repository')}
              className="mb-4"
              data-testid="button-back-to-repository"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Repository
            </Button>
            <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="statement-text">
              {statement.statement}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDistanceToNow(new Date(statement.createdAt), { addSuffix: true })}
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                {frameworks.length} {frameworks.length === 1 ? 'framework' : 'frameworks'}
              </div>
            </div>
          </div>
        </div>

        {/* Analyses */}
        {hasAnalyses ? (
          <Tabs defaultValue={frameworks[0]} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${frameworks.length}, 1fr)` }}>
              {frameworks.map((framework) => (
                <TabsTrigger key={framework} value={framework} data-testid={`tab-${framework}`}>
                  <span className="mr-2">{getFrameworkIcon(framework)}</span>
                  {framework}
                  <Badge variant="secondary" className="ml-2">
                    {statement.analyses[framework].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {frameworks.map((framework) => (
              <TabsContent key={framework} value={framework} className="space-y-4">
                {statement.analyses[framework].map((analysis, index) => (
                  <Card key={analysis.id} data-testid={`analysis-card-${framework}-${index}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <span className="text-2xl">{getFrameworkIcon(framework)}</span>
                            <span className={getFrameworkColor(framework)}>
                              {framework} Analysis
                            </span>
                            <Badge variant="outline">v{analysis.version}</Badge>
                          </CardTitle>
                          <CardDescription className="mt-2 flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                            </span>
                            {analysis.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(analysis.duration / 1000).toFixed(1)}s
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <Button
                          onClick={() => handleViewFullReport(framework, statement.sessionId)}
                          variant="default"
                          data-testid={`button-view-report-${framework}-${index}`}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Full Report
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Summary */}
                      {analysis.summary && (
                        <div>
                          <h4 className="font-semibold text-sm text-muted-foreground mb-2">Executive Summary</h4>
                          <p className="text-sm text-foreground">{analysis.summary}</p>
                        </div>
                      )}

                      {/* Key Findings */}
                      {analysis.keyFindings && analysis.keyFindings.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-muted-foreground mb-2">Key Findings</h4>
                          <ul className="space-y-2">
                            {analysis.keyFindings.map((finding, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-primary mt-1">•</span>
                                <span>{finding}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!analysis.summary && !analysis.keyFindings?.length && (
                        <div className="text-sm text-muted-foreground italic">
                          Click "View Full Report" to see complete analysis details
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold text-foreground">No analyses yet</h3>
                <p className="text-muted-foreground mt-2">
                  No framework analyses have been run for this statement
                </p>
              </div>
              <Button
                onClick={() => setLocation(`/strategic-consultant/input`)}
                className="mt-4"
                data-testid="button-run-analysis"
              >
                Run Analysis
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
