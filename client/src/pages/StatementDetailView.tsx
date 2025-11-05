import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Calendar, Clock, TrendingUp, FileText, ExternalLink, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { StatementDetail } from '@/types/repository';
import { DeleteAnalysisDialog } from '@/components/DeleteAnalysisDialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function StatementDetailView() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/repository/:understandingId');
  const understandingId = params?.understandingId;
  const { toast } = useToast();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAnalysisId, setDeleteAnalysisId] = useState<string | null>(null);
  const [deleteFramework, setDeleteFramework] = useState<string>('');

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

  const handleViewFullReport = (framework: string, sessionId: string, versionNumber?: number) => {
    if (framework === 'PESTLE') {
      setLocation(`/strategic-consultant/trend-analysis/${sessionId}/1`);
    } else if (framework === 'Business Model Canvas') {
      const version = versionNumber || 1;
      setLocation(`/strategic-consultant/results/${sessionId}/${version}`);
    } else if (framework === 'Five Whys') {
      const version = versionNumber || 1;
      setLocation(`/strategic-consultant/results/${sessionId}/${version}`);
    }
  };

  const handleDeleteClick = (analysisId: string, framework: string) => {
    setDeleteAnalysisId(analysisId);
    setDeleteFramework(framework);
    setShowDeleteDialog(true);
  };

  const handleDeleteAnalysis = async () => {
    if (!deleteAnalysisId) return;

    setIsDeleting(true);
    try {
      await apiRequest('DELETE', `/api/repository/analyses/${deleteAnalysisId}`);
      
      toast({
        title: 'Analysis deleted',
        description: `Your ${deleteFramework} analysis has been permanently deleted`,
      });

      // Invalidate cache to refresh the statement details
      await queryClient.invalidateQueries({ queryKey: [`/api/repository/statements/${understandingId}`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
    } catch (error) {
      console.error('Error deleting analysis:', error);
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Could not delete analysis',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteAnalysisId(null);
      setDeleteFramework('');
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
            <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="statement-title">
              {statement.title || statement.statement}
            </h1>
            {statement.title && (
              <Accordion type="single" collapsible className="mb-4">
                <AccordionItem value="original-input" className="border rounded-lg bg-muted/50">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid="accordion-original-input">
                    <h2 className="text-sm font-semibold text-muted-foreground">Original Input</h2>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <p className="text-base text-foreground whitespace-pre-wrap" data-testid="statement-original-input">
                      {statement.statement}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
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
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <TabsList className="inline-flex sm:grid w-full min-w-max sm:min-w-0 px-4 sm:px-0" style={{ gridTemplateColumns: `repeat(${frameworks.length}, 1fr)` }}>
                {frameworks.map((framework) => (
                  <TabsTrigger key={framework} value={framework} className="flex-shrink-0 whitespace-nowrap" data-testid={`tab-${framework}`}>
                    <span className="mr-2">{getFrameworkIcon(framework)}</span>
                    {framework}
                    <Badge variant="secondary" className="ml-2">
                      {statement.analyses[framework].length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {frameworks.map((framework) => (
              <TabsContent key={framework} value={framework} className="space-y-4">
                {statement.analyses[framework].map((analysis, index) => (
                  <Card key={analysis.id} data-testid={`analysis-card-${framework}-${index}`}>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="flex flex-wrap items-center gap-2">
                            <span className="text-2xl">{getFrameworkIcon(framework)}</span>
                            <span className={getFrameworkColor(framework)}>
                              {framework} Analysis
                            </span>
                            <Badge variant="outline">v{analysis.version}</Badge>
                          </CardTitle>
                          <CardDescription className="mt-2 flex flex-wrap items-center gap-4">
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
                        <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                          <Button
                            onClick={() => handleDeleteClick(analysis.id, framework)}
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            data-testid={`button-delete-${framework}-${index}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button
                            onClick={() => handleViewFullReport(framework, statement.sessionId, analysis.versionNumber)}
                            variant="default"
                            size="sm"
                            className="whitespace-nowrap"
                            data-testid={`button-view-report-${framework}-${index}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                            View Full Report
                          </Button>
                        </div>
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
                            {analysis.keyFindings.map((finding, i) => {
                              const findingText = typeof finding === 'string' 
                                ? finding 
                                : (finding as any)?.answer || (finding as any)?.question || JSON.stringify(finding);
                              return (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className="text-primary mt-1">•</span>
                                  <span>{findingText}</span>
                                </li>
                              );
                            })}
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
                onClick={() => setLocation(`/strategic-consultant/input?text=${encodeURIComponent(statement.statement)}`)}
                className="mt-4"
                data-testid="button-run-analysis"
              >
                Run Analysis
              </Button>
            </div>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteAnalysisDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDeleteAnalysis}
          frameworkName={deleteFramework}
          isDeleting={isDeleting}
        />
      </div>
    </AppLayout>
  );
}
