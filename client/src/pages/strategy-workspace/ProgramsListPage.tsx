import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FileText, 
  Search, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  FileEdit,
  ArrowRight,
  Trash2,
  Archive,
  Download
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ExportFullReportButton } from '@/components/epm/ExportFullReportButton';

interface EPMProgram {
  id: string;
  title: string;
  frameworkType: string;
  status: 'draft' | 'finalized';
  overallConfidence: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  strategyVersionId: string;
}

export function ProgramsListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  
  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const { data, isLoading } = useQuery<{ programs: EPMProgram[] }>({
    queryKey: ['/api/strategy-workspace/epm'],
  });

  const programs = data?.programs || [];
  
  // Filter programs by search query
  const filteredPrograms = programs.filter(prog => 
    prog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prog.frameworkType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by status
  const draftPrograms = filteredPrograms.filter(p => p.status === 'draft');
  const finalizedPrograms = filteredPrograms.filter(p => p.status === 'finalized');

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPrograms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPrograms.map(p => p.id)));
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

  // Batch operations
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsBatchProcessing(true);
    try {
      await apiRequest('POST', '/api/strategy-workspace/epm/batch-delete', {
        ids: Array.from(selectedIds),
      });
      
      toast({
        title: 'Programs deleted',
        description: `${selectedIds.size} program(s) deleted successfully`,
      });

      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['/api/strategy-workspace/epm'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard-summary'] });
    } catch (error) {
      console.error('Error batch deleting:', error);
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'Could not delete programs',
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
      await apiRequest('POST', '/api/strategy-workspace/epm/batch-archive', {
        ids: Array.from(selectedIds),
        archive: true,
      });
      
      toast({
        title: 'Programs archived',
        description: `${selectedIds.size} program(s) archived successfully`,
      });

      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['/api/strategy-workspace/epm'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard-summary'] });
    } catch (error) {
      console.error('Error batch archiving:', error);
      toast({
        title: 'Failed to archive',
        description: error instanceof Error ? error.message : 'Could not archive programs',
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
      const response = await apiRequest('POST', '/api/strategy-workspace/epm/batch-export', {
        ids: Array.from(selectedIds),
      });
      
      // Download as JSON file
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `epm-programs-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Export successful',
        description: `${selectedIds.size} program(s) exported successfully`,
      });
    } catch (error) {
      console.error('Error batch exporting:', error);
      toast({
        title: 'Failed to export',
        description: error instanceof Error ? error.message : 'Could not export programs',
        variant: 'destructive',
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'finalized') {
      return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Finalized</Badge>;
    }
    return <Badge variant="outline"><FileEdit className="w-3 h-3 mr-1" /> Draft</Badge>;
  };

  const getConfidenceBadge = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    const color = percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-orange-500';
    return <Badge className={color}><TrendingUp className="w-3 h-3 mr-1" /> {percentage}%</Badge>;
  };

  const getFrameworkIcon = (framework: string) => {
    // Framework-agnostic icon mapping
    return <FileText className="w-5 h-5 text-primary" />;
  };

  return (
    <AppLayout 
      title="EPM Programs" 
      subtitle="All your generated EPM programs from strategic analysis"
    >
      <div className="p-8 max-w-7xl mx-auto space-y-6">

        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search programs by title or framework..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-programs"
            />
          </div>
        </div>

        {/* Batch action bar */}
        {!isLoading && filteredPrograms.length > 0 && (
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filteredPrograms.length > 0 && selectedIds.size === filteredPrograms.length}
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
                  <Archive className="h-4 w-4 mr-2" />
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

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && programs.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No EPM Programs Yet</h3>
              <p className="text-muted-foreground mb-6">
                Complete a strategic analysis journey to generate your first EPM program
              </p>
              <Button asChild data-testid="button-start-journey">
                <Link href="/strategic-consultant">
                  Start Strategic Analysis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Search Results */}
        {!isLoading && programs.length > 0 && filteredPrograms.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Search className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No programs found</h3>
              <p className="text-muted-foreground">
                Try a different search term
              </p>
            </CardContent>
          </Card>
        )}

        {/* Draft Programs */}
        {!isLoading && draftPrograms.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileEdit className="w-5 h-5" />
              Draft Programs ({draftPrograms.length})
            </h2>
            {draftPrograms.map((program) => (
              <Card key={program.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(program.id)}
                      onCheckedChange={() => toggleSelection(program.id)}
                      data-testid={`checkbox-${program.id}`}
                      className="mt-1"
                    />
                    <div className="flex items-start justify-between flex-1">
                      <div className="flex items-start gap-3 flex-1">
                        {getFrameworkIcon(program.frameworkType)}
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-1">{program.title}</CardTitle>
                          <CardDescription>{program.frameworkType}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(program.status)}
                        {getConfidenceBadge(program.overallConfidence)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Created {format(new Date(program.createdAt), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Updated {format(new Date(program.updatedAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <Button asChild data-testid={`button-view-program-${program.id}`}>
                      <Link href={`/strategy-workspace/epm/${program.id}`}>
                        View Program <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <div className="pt-2 border-t">
                    <ExportFullReportButton
                      programId={program.id}
                      variant="ghost"
                      size="sm"
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Finalized Programs */}
        {!isLoading && finalizedPrograms.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Finalized Programs ({finalizedPrograms.length})
            </h2>
            {finalizedPrograms.map((program) => (
              <Card key={program.id} className="hover:shadow-md transition-shadow border-green-500/20">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(program.id)}
                      onCheckedChange={() => toggleSelection(program.id)}
                      data-testid={`checkbox-${program.id}`}
                      className="mt-1"
                    />
                    <div className="flex items-start justify-between flex-1">
                      <div className="flex items-start gap-3 flex-1">
                        {getFrameworkIcon(program.frameworkType)}
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-1">{program.title}</CardTitle>
                          <CardDescription>{program.frameworkType}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(program.status)}
                        {getConfidenceBadge(program.overallConfidence)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Created {format(new Date(program.createdAt), 'MMM d, yyyy')}
                      </div>
                      {program.finalizedAt && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Finalized {format(new Date(program.finalizedAt), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                    <Button asChild data-testid={`button-view-program-${program.id}`}>
                      <Link href={`/strategy-workspace/epm/${program.id}`}>
                        View Program <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <div className="pt-2 border-t">
                    <ExportFullReportButton
                      programId={program.id}
                      variant="ghost"
                      size="sm"
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
