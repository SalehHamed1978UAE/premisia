import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { AlertCircle, Lightbulb, TrendingUp, DollarSign, FileText, ExternalLink, Lock, Calendar, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { SimilarStrategy, Incentive, Evidence } from "@/hooks/useKnowledgeInsights";

interface KnowledgeInsightsCardProps {
  title?: string;
  insights?: {
    similarStrategies: SimilarStrategy[];
    incentives: Incentive[];
    evidence: Evidence[];
  };
  loading?: boolean;
  error?: Error | null;
  hasConsent?: boolean;
  dataClassification?: 'user-scoped' | 'aggregate' | 'shared';
}

export function KnowledgeInsightsCard({
  title = "Knowledge Graph Insights",
  insights,
  loading = false,
  error = null,
  hasConsent = true,
  dataClassification = 'user-scoped',
}: KnowledgeInsightsCardProps) {
  // Loading state
  if (loading) {
    return (
      <Card data-testid="card-knowledge-insights-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>Loading insights from knowledge graph...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card data-testid="card-knowledge-insights-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load insights. {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No consent state
  if (!hasConsent) {
    return (
      <Card data-testid="card-knowledge-insights-no-consent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>Insights not available</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Knowledge Graph insights are not available. Data sharing consent may be required.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const similarStrategies = insights?.similarStrategies || [];
  const incentives = insights?.incentives || [];
  const evidence = insights?.evidence || [];

  // Empty state - no insights available
  if (similarStrategies.length === 0 && incentives.length === 0 && evidence.length === 0) {
    return (
      <Card data-testid="card-knowledge-insights-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>No insights available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No similar strategies, incentives, or evidence found at this time. Check back later as more data becomes available.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Helper function to format date
  const formatDate = (dateStr: string): string => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  // Helper function to format confidence percentage
  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };

  return (
    <Card data-testid="card-knowledge-insights">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>
              AI-powered insights from strategic analysis
            </CardDescription>
          </div>
          {dataClassification === 'user-scoped' && (
            <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-privacy">
              <Lock className="h-3 w-3" />
              Private to your account
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Similar Strategies Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Similar Strategies</h3>
              {similarStrategies.length > 0 && (
                <Badge variant="secondary" data-testid="badge-similar-count">
                  {similarStrategies.length}
                </Badge>
              )}
            </div>
            
            {similarStrategies.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-similar">
                No similar strategies found
              </p>
            ) : (
              <div className="space-y-3">
                {similarStrategies.map((strategy, index) => (
                  <Link 
                    key={strategy.strategyId} 
                    href={`/strategies/${strategy.strategyId}?session=${strategy.sessionId}`}
                  >
                    <div 
                      className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                      data-testid={`card-similar-strategy-${index}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm line-clamp-2">
                          {strategy.title}
                        </p>
                        <Badge variant="outline" className="text-xs shrink-0" data-testid={`badge-score-${index}`}>
                          {formatConfidence(strategy.score)} match
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2" data-testid={`text-summary-${index}`}>
                        {strategy.summary}
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Calendar className="h-3 w-3" />
                        <span data-testid={`text-completed-${index}`}>
                          Completed {formatDate(strategy.completedAt)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <span>View strategy</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Available Incentives Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Available Incentives</h3>
              {incentives.length > 0 && (
                <Badge variant="secondary" data-testid="badge-incentives-count">
                  {incentives.length}
                </Badge>
              )}
            </div>
            
            {incentives.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-incentives">
                No applicable incentives found
              </p>
            ) : (
              <div className="space-y-3">
                {incentives.map((incentive, index) => (
                  <div 
                    key={incentive.id}
                    className="p-3 rounded-lg border bg-card"
                    data-testid={`card-incentive-${index}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium text-sm line-clamp-2">
                        {incentive.name}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0" data-testid={`badge-incentive-score-${index}`}>
                        {formatConfidence(incentive.score)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground" data-testid={`text-jurisdiction-${index}`}>
                        {incentive.jurisdiction}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground" data-testid={`text-deadline-${index}`}>
                        Deadline: {formatDate(incentive.deadline)}
                      </p>
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-3" data-testid={`text-rationale-${index}`}>
                      {incentive.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence & Citations Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Evidence</h3>
              {evidence.length > 0 && (
                <Badge variant="secondary" data-testid="badge-evidence-count">
                  {evidence.length}
                </Badge>
              )}
            </div>
            
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-evidence">
                No evidence citations found
              </p>
            ) : (
              <div className="space-y-3">
                {evidence.map((item, index) => (
                  <div 
                    key={item.referenceId}
                    className="p-3 rounded-lg border bg-card"
                    data-testid={`card-evidence-${index}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium text-sm line-clamp-2">
                        {item.title}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0" data-testid={`badge-confidence-${index}`}>
                        {formatConfidence(item.confidence)}
                      </Badge>
                    </div>
                    
                    <div className="mb-2">
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-topic-${index}`}>
                        {item.topic}
                      </Badge>
                    </div>
                    
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                      data-testid={`link-evidence-${index}`}
                    >
                      <span className="line-clamp-1">View source</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
