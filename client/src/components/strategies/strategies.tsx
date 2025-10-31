import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Sparkles, 
  FileText, 
  Calendar, 
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

interface StrategyVersion {
  id: string;
  versionNumber: number;
  versionLabel?: string;
  inputSummary?: string;
  status: string;
  createdAt: string;
  sessionId: string;
}

export function Strategies() {
  const [, setLocation] = useLocation();
  
  const { data: versions, isLoading, error } = useQuery<StrategyVersion[]>({
    queryKey: ['/api/strategic-consultant/versions'],
    queryFn: async () => {
      const res = await fetch('/api/strategic-consultant/versions/all', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch strategy versions');
      return res.json();
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted_to_program':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'finalized':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'converting':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted_to_program':
        return <CheckCircle className="h-4 w-4" />;
      case 'converting':
        return <Clock className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'converted_to_program':
        return 'Integrated to EPM';
      case 'finalized':
        return 'Finalized';
      case 'converting':
        return 'Converting';
      default:
        return status;
    }
  };

  const handleViewStrategy = (version: StrategyVersion) => {
    // Navigate to the EPM page for this version
    setLocation(`/strategic-consultant/epm/${version.sessionId}/${version.versionNumber}`);
  };

  const handleViewProgram = (programId: string) => {
    // Could navigate to program detail page - for now just navigate to dashboard
    setLocation('/');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load strategy versions. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Strategic Decisions Yet</h3>
            <p className="text-muted-foreground mb-6">
              Use the Strategic Consultant to analyze executive input and generate strategic decisions.
            </p>
            <Button 
              onClick={() => setLocation('/strategic-consultant/input')}
              data-testid="button-start-strategic-consultant"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start Strategic Consultant
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-muted-foreground">
            {versions.length} strateg{versions.length === 1 ? 'y' : 'ies'} created
          </p>
        </div>
        <Button 
          onClick={() => setLocation('/strategic-consultant/input')}
          data-testid="button-new-strategy"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          New Strategy
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {versions.map((version) => (
          <Card key={version.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {version.versionLabel || `Strategy Version ${version.versionNumber}`}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {version.inputSummary || 'Strategic analysis and decision framework'}
                  </CardDescription>
                </div>
                <Badge 
                  variant="secondary" 
                  className={getStatusColor(version.status)}
                >
                  <span className="flex items-center gap-1">
                    {getStatusIcon(version.status)}
                    {getStatusLabel(version.status)}
                  </span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Created {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                  </div>
                  {version.status === 'converted_to_program' && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Integrated
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewStrategy(version)}
                    data-testid={`button-view-strategy-${version.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Strategy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
