import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { AlertCircle, Lightbulb, TrendingUp, DollarSign, Calendar, ExternalLink, AlertTriangle } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import type { SimilarStrategy, Incentive } from "@/hooks/useKnowledgeInsights";

interface KnowledgeInsightsCardProps {
  title?: string;
  insights?: {
    similarStrategies: SimilarStrategy[];
    incentives: Incentive[];
  };
  loading?: boolean;
  error?: Error | null;
  hasConsent?: boolean;
}

export function KnowledgeInsightsCard({
  title = "Knowledge Graph Insights",
  insights,
  loading = false,
  error = null,
  hasConsent = true,
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
          <CardDescription>Loading insights from peer strategies...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <CardDescription>Peer insights not available</CardDescription>
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

  // Empty state - no insights available
  if (similarStrategies.length === 0 && incentives.length === 0) {
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
              No similar strategies or incentives found at this time. Check back later as more data becomes available.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Helper function to check if incentive is expiring soon (within 30 days)
  const isExpiringSoon = (expiryDate?: string): boolean => {
    if (!expiryDate) return false;
    try {
      const expiry = parseISO(expiryDate);
      const daysUntilExpiry = differenceInDays(expiry, new Date());
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    } catch {
      return false;
    }
  };

  // Helper function to format expiry date
  const formatExpiryDate = (expiryDate?: string): string => {
    if (!expiryDate) return 'No expiry';
    try {
      return format(parseISO(expiryDate), 'MMM d, yyyy');
    } catch {
      return expiryDate;
    }
  };

  return (
    <Card data-testid="card-knowledge-insights">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          Showing insights from peers who opted into sharing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    key={strategy.sessionId} 
                    href={`/strategies/${strategy.sessionId}`}
                  >
                    <div 
                      className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                      data-testid={`card-similar-strategy-${index}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm line-clamp-1">
                          {strategy.journeyType.replace(/_/g, ' ')}
                        </p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {Math.round(strategy.similarity * 100)}% match
                        </Badge>
                      </div>
                      
                      {strategy.matchedFactors && strategy.matchedFactors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {strategy.matchedFactors.slice(0, 3).map((factor, i) => (
                            <Badge 
                              key={i} 
                              variant="secondary" 
                              className="text-xs"
                              data-testid={`badge-factor-${index}-${i}`}
                            >
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {strategy.location && (
                          <span data-testid={`text-location-${index}`}>
                            📍 {strategy.location}
                          </span>
                        )}
                        {strategy.industry && (
                          <span data-testid={`text-industry-${index}`}>
                            🏢 {strategy.industry}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                        <span>View details</span>
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
                {incentives.map((incentive, index) => {
                  const expiringSoon = isExpiringSoon(incentive.expiryDate);
                  
                  return (
                    <div 
                      key={incentive.incentiveId}
                      className="p-3 rounded-lg border bg-card"
                      data-testid={`card-incentive-${index}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm line-clamp-2">
                          {incentive.name}
                        </p>
                        <Badge 
                          variant={incentive.type === 'grant' ? 'default' : 'outline'}
                          className="text-xs shrink-0"
                        >
                          {incentive.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2">
                        <span className="font-medium">Provider:</span> {incentive.provider}
                      </p>
                      
                      {incentive.amount && (
                        <p className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium">Amount:</span> {incentive.amount}
                        </p>
                      )}
                      
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {incentive.eligibilitySummary}
                      </p>
                      
                      {incentive.expiryDate && (
                        <div className={`flex items-center gap-1 text-xs ${expiringSoon ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                          {expiringSoon && <AlertTriangle className="h-3 w-3" />}
                          <Calendar className="h-3 w-3" />
                          <span data-testid={`text-expiry-${index}`}>
                            Expires: {formatExpiryDate(incentive.expiryDate)}
                          </span>
                          {expiringSoon && (
                            <Badge variant="destructive" className="text-xs ml-1">
                              Expiring soon
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {incentive.link && (
                        <a 
                          href={incentive.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                          data-testid={`link-incentive-${index}`}
                        >
                          <span>Learn more</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
