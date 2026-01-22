import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Archive, Calendar, TrendingUp, FileText, AlertTriangle, Trash2, ArchiveIcon, Download, Eye, PlayCircle, Rocket, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { StatementSummary } from '@/types/repository';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { DeleteAnalysisDialog } from '@/components/DeleteAnalysisDialog';
import { ExportFullReportButton } from '@/components/epm/ExportFullReportButton';
import { PlanningProgressTracker } from '@/components/intelligent-planning/PlanningProgressTracker';

export default function RepositoryBrowser() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteUnderstandingId, setDeleteUnderstandingId] = useState<string | null>(null);
  
  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  
  // EPM generation state
  const [generatingSessionId, setGeneratingSessionId] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  const { data: statements, isLoading, error, refetch } = useQuery<StatementSummary[]>({
    queryKey: ['/api/repository/statements'],
  });
  
  // Cleanup EventSource on component unmount
  useEffect(() => {
    return () => {
      if ((window as any).__currentEventSource) {
        (window as any).__currentEventSource.close();
        delete (window as any).__currentEventSource;
      }
    };
  }, []);
  
  // Handle Generate EPM from analysis
  const handleGenerateEPM = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setGeneratingSessionId(sessionId);
    
    try {
      // Always force regenerate when user explicitly clicks "Generate EPM"
      // This ensures a fresh generation instead of resuming old/failed sessions
      const res = await apiRequest('POST', '/api/strategy-workspace/epm/generate-from-session', {
        sessionId,
        forceRegenerate: true,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      
      const response = await res.json() as { success: boolean; progressId: string; message: string };
      
      if (response.progressId) {
        setShowProgress(true);
        
        // Connect to SSE for progress updates
        const eventSource = new EventSource(`/api/strategy-workspace/epm/progress/${response.progressId}`);
        
        // Store reference to close on cleanup
        (window as any).__currentEventSource = eventSource;
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Update progress tracker via window function
            if ((window as any).__updatePlanningProgress) {
              (window as any).__updatePlanningProgress(data);
            }
            
            // Handle completion
            if (data.type === 'complete') {
              eventSource.close();
              delete (window as any).__currentEventSource;
              setShowProgress(false);
              setGeneratingSessionId(null);
              refetch();
              toast({
                title: 'EPM Program Generated',
                description: 'Your program has been successfully generated.',
              });
            }
            
            // Handle error
            if (data.type === 'error') {
              eventSource.close();
              delete (window as any).__currentEventSource;
              setShowProgress(false);
              setGeneratingSessionId(null);
              toast({
                title: 'Generation Failed',
                description: data.message || 'Failed to generate EPM program',
                variant: 'destructive',
              });
            }
          } catch (err) {
            console.error('Error parsing SSE data:', err);
          }
        };
        
        eventSource.onerror = () => {
          eventSource.close();
          delete (window as any).__currentEventSource;
          setShowProgress(false);
          setGeneratingSessionId(null);
        };
      }
    } catch (error) {
      console.error('Error generating EPM:', error);
      setGeneratingSessionId(null);
      toast({
        title: 'Failed to Generate EPM',
        description: error instanceof Error ? error.message : 'Could not generate EPM program',
        variant: 'destructive',
      });
    }
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (!statements) return;
    if (selectedIds.size === statements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(statements.map(s => s.understandingId)));
    }
  };

  // Toggle individual selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleArchive = async (e: React.MouseEvent, understandingId: string) => {
    e.stopPropagation();
    try {
      await apiRequest('POST', '/api/repository/batch-archive', {
        ids: [understandingId],
        archive: true,
      });
      
      toast({
        title: 'Statement archived',
        description: 'The statement has been archived successfully',
      });

      await queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
    } catch (error) {
      console.error('Error archiving statement:', error);
      toast({
        title: 'Failed to archive',
        description: error instanceof Error ? error.message : 'Could not archive statement',
        variant: 'destructive',
      });
    }
  };

  // Batch operations
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsBatchProcessing(true);
    try {
      await apiRequest('POST', '/api/repository/batch-delete', {
        ids: Array.from(selectedIds),
      });
      
      toast({
        title: 'Statements deleted',
        description: `${selectedIds.size} statement(s) deleted successfully`,
      });

      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard-summary'] });
    } catch (error) {
      console.error('Error batch deleting:', error);
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Could not delete statements',
        variant: 'destructive',
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) return;

    setIsBatchProcessing(true);
    try {
      await apiRequest('POST', '/api/repository/batch-archive', {
        ids: Array.from(selectedIds),
        archive: true,
      });
      
      toast({
        title: 'Statements archived',
        description: `${selectedIds.size} statement(s) archived successfully`,
      });

      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard-summary'] });
    } catch (error) {
      console.error('Error batch archiving:', error);
      toast({
        title: 'Failed to archive',
        description: error instanceof Error ? error.message : 'Could not archive statements',
        variant: 'destructive',
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchExport = async () => {
    if (selectedIds.size === 0) return;

    setIsBatchProcessing(true);
    try {
      const response = await apiRequest('POST', '/api/repository/batch-export', {
        ids: Array.from(selectedIds),
      });
      
      // Download as JSON file
      const dataStr = JSON.stringify(response, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analyses-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Export successful',
        description: `${selectedIds.size} statement(s) exported successfully`,
      });
    } catch (error) {
      console.error('Error batch exporting:', error);
      toast({
        title: 'Failed to export',
        description: error instanceof Error ? error.message : 'Could not export statements',
        variant: 'destructive',
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, understandingId: string) => {
    e.stopPropagation();
    setDeleteUnderstandingId(understandingId);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteUnderstandingId) return;

    setIsDeleting(true);
    try {
      await apiRequest('POST', '/api/repository/batch-delete', {
        ids: [deleteUnderstandingId],
      });
      
      toast({
        title: 'Analysis deleted',
        description: 'The analysis and all related artifacts have been permanently deleted',
      });

      await queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard-summary'] });
    } catch (error) {
      console.error('Error deleting statement:', error);
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Could not delete analysis',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteUnderstandingId(null);
    }
  };

  const handleArchiveFromDialog = async () => {
    if (!deleteUnderstandingId) return;

    try {
      await apiRequest('POST', '/api/repository/batch-archive', {
        ids: [deleteUnderstandingId],
        archive: true,
      });
      
      toast({
        title: 'Analysis archived',
        description: 'The analysis and all related artifacts have been archived',
      });

      await queryClient.invalidateQueries({ queryKey: ['/api/repository/statements'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard-summary'] });
    } catch (error) {
      console.error('Error archiving statement:', error);
      toast({
        title: 'Failed to archive',
        description: error instanceof Error ? error.message : 'Could not archive analysis',
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
    >
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3" data-testid="page-title">
                <Archive className="h-8 w-8 text-primary" />
                Analysis Repository
              </h1>
              <p className="text-muted-foreground mt-2">
                {statements?.length || 0} strategic statements with analyses
              </p>
            </div>
          </div>

          {/* Batch action bar */}
          {statements && statements.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={statements.length > 0 && selectedIds.size === statements.length}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm font-medium">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                </span>
              </div>

              {selectedIds.size > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchExport}
                    disabled={isBatchProcessing}
                    data-testid="button-batch-export"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchArchive}
                    disabled={isBatchProcessing}
                    data-testid="button-batch-archive"
                  >
                    <ArchiveIcon className="h-4 w-4 mr-2" />
                    Archive ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleBatchDelete}
                    disabled={isBatchProcessing}
                    data-testid="button-batch-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedIds.size})
                  </Button>
                </div>
              )}
            </div>
          )}
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
                className="hover:shadow-lg transition-shadow border-2 hover:border-primary/50"
                data-testid={`statement-card-${statement.understandingId}`}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(statement.understandingId)}
                      onCheckedChange={() => toggleSelection(statement.understandingId)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-${statement.understandingId}`}
                      className="mt-1"
                    />
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setLocation(`/repository/${statement.understandingId}`)}
                    >
                      <CardTitle className="text-lg" data-testid={`statement-title-${statement.understandingId}`}>
                        {statement.title || statement.statement}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(statement.createdAt), { addSuffix: true })}
                      </CardDescription>
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

                  {/* Continue Journey Button - only show for incomplete journeys */}
                  {statement.journeyProgress?.status !== 'completed' && statement.journeyProgress?.nextUrl && (
                    <div className="pt-2 border-t mb-2">
                      <Button
                        className="w-full gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(statement.journeyProgress!.nextUrl!);
                        }}
                        data-testid={`button-continue-journey-${statement.understandingId}`}
                      >
                        <PlayCircle className="h-4 w-4" />
                        Continue Journey
                      </Button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-1 pt-2 border-t">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-primary hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/repository/${statement.understandingId}`);
                      }}
                      data-testid={`button-view-${statement.understandingId}`}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => handleGenerateEPM(e, statement.sessionId)}
                      disabled={generatingSessionId === statement.sessionId}
                      data-testid={`button-generate-epm-${statement.understandingId}`}
                      title="Generate EPM Program"
                    >
                      {generatingSessionId === statement.sessionId ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Rocket className="h-4 w-4 text-green-600 hover:text-green-500" />
                      )}
                    </Button>
                    <ExportFullReportButton
                      sessionId={statement.sessionId}
                      variant="ghost"
                      size="icon"
                    />
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
                      onClick={(e) => handleDeleteClick(e, statement.understandingId)}
                      data-testid={`button-delete-${statement.understandingId}`}
                      title="Delete statement"
                    >
                      <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" />
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

        {/* Delete Confirmation Dialog */}
        {deleteUnderstandingId && (
          <DeleteAnalysisDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            onDelete={handleDeleteConfirm}
            onArchive={handleArchiveFromDialog}
            understandingId={deleteUnderstandingId}
            isDeleting={isDeleting}
          />
        )}
      </div>
      
      {/* Progress Tracker Overlay */}
      {showProgress && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => {}} 
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <PlanningProgressTracker 
              onComplete={() => {
                setShowProgress(false);
                setGeneratingSessionId(null);
                refetch();
              }}
              onError={(error) => {
                setShowProgress(false);
                setGeneratingSessionId(null);
                toast({
                  title: 'Generation Failed',
                  description: error,
                  variant: 'destructive',
                });
              }}
            />
          </div>
        </>
      )}
    </AppLayout>
  );
}
