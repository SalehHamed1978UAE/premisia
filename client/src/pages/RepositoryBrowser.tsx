import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Archive, Calendar, TrendingUp, FileText, AlertTriangle, Trash2, ArchiveIcon, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { StatementSummary } from '@/types/repository';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { DeleteAnalysisDialog } from '@/components/DeleteAnalysisDialog';

export default function RepositoryBrowser() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteUnderstandingId, setDeleteUnderstandingId] = useState<string | null>(null);
  
  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const { data: statements, isLoading, error } = useQuery<StatementSummary[]>({
    queryKey: ['/api/repository/statements'],
  });

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
      const dataStr = JSON.stringify(response.data, null, 2);
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
      await apiRequest('DELETE', `/api/repository/statements/${deleteUnderstandingId}`);
      
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
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteUnderstandingId(null);
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
        <div className="flex flex-col gap-4">
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

          {/* Batch action bar */}
          {statements && statements.length > 0 && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
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
                <div className="flex items-center gap-2 ml-auto">
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
                        onClick={(e) => handleDeleteClick(e, statement.understandingId)}
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

        {/* Delete Confirmation Dialog */}
        <DeleteAnalysisDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDeleteConfirm}
          frameworkName="Statement and All Analyses"
          isDeleting={isDeleting}
        />
      </div>
    </AppLayout>
  );
}
