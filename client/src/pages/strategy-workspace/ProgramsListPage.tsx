import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  Search, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  FileEdit,
  ArrowRight 
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

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
                  <div className="flex items-start justify-between">
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
                </CardHeader>
                <CardContent>
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
                  <div className="flex items-start justify-between">
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
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
