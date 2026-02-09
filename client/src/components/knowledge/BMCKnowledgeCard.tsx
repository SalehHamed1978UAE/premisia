import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, Search, AlertCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Entity {
  id: string;
  type: string;
  claim: string;
  source: string;
  evidence?: string;
  confidence?: string;
  discoveredBy: string;
}

interface Contradiction {
  userClaim: Entity;
  researchClaim: Entity;
  evidence: string;
}

interface BMCKnowledgeData {
  userAssumptions: Entity[];
  researchFindings: Entity[];
  contradictions: Contradiction[];
  criticalGaps: string[];
}

interface BMCKnowledgeCardProps {
  programId: string;
  data?: BMCKnowledgeData;
  loading?: boolean;
  error?: Error | null;
}

function CollapsibleSection({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = false,
  variant = "default"
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: "default" | "warning" | "destructive";
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const badgeVariant = variant === "destructive" ? "destructive" : variant === "warning" ? "secondary" : "default";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent rounded-lg transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant={badgeVariant} data-testid={`badge-${title.toLowerCase().replace(/\s+/g, '-')}-count`}>
            {count}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BMCKnowledgeCard({ programId, data, loading = false, error = null }: BMCKnowledgeCardProps) {
  // Loading state
  if (loading) {
    return (
      <Card data-testid="card-bmc-knowledge-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Before You Launch
          </CardTitle>
          <CardDescription>Loading knowledge graph insights...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card data-testid="card-bmc-knowledge-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Before You Launch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load knowledge insights. {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No data - don't render anything
  if (!data) {
    return null;
  }

  const { userAssumptions, researchFindings, contradictions, criticalGaps } = data;

  // If all sections are empty, don't render
  const hasData = userAssumptions.length > 0 || 
                  researchFindings.length > 0 || 
                  contradictions.length > 0 || 
                  criticalGaps.length > 0;

  if (!hasData) {
    return null;
  }

  return (
    <Card data-testid="card-bmc-knowledge">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Before You Launch
        </CardTitle>
        <CardDescription>
          Critical insights from your strategic analysis to review before execution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Your Assumptions Section */}
        {userAssumptions.length > 0 && (
          <CollapsibleSection
            icon={Lightbulb}
            title="Your Assumptions"
            count={userAssumptions.length}
            defaultOpen={true}
          >
            <div className="space-y-3 mt-3">
              {userAssumptions.map((assumption) => (
                <div
                  key={assumption.id}
                  className="p-3 rounded-lg border bg-card"
                  data-testid={`assumption-${assumption.id}`}
                >
                  <p className="text-sm font-medium mb-1">{assumption.claim}</p>
                  {assumption.source && (
                    <p className="text-xs text-muted-foreground italic">
                      Source: "{assumption.source}"
                    </p>
                  )}
                  {assumption.confidence && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {assumption.confidence} confidence
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Research Findings Section */}
        {researchFindings.length > 0 && (
          <CollapsibleSection
            icon={Search}
            title="Research Findings"
            count={researchFindings.length}
            defaultOpen={true}
          >
            <div className="space-y-3 mt-3">
              {researchFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="p-3 rounded-lg border bg-card"
                  data-testid={`finding-${finding.id}`}
                >
                  <p className="text-sm font-medium mb-1">{finding.claim}</p>
                  {finding.evidence && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {finding.evidence}
                    </p>
                  )}
                  {finding.confidence && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {finding.confidence} confidence
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Contradictions to Resolve Section */}
        {contradictions.length > 0 && (
          <CollapsibleSection
            icon={AlertCircle}
            title="Contradictions to Resolve"
            count={contradictions.length}
            defaultOpen={true}
            variant="warning"
          >
            <div className="space-y-3 mt-3">
              {contradictions.map((contradiction, index) => (
                <Alert key={index} variant="destructive" data-testid={`contradiction-${index}`}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm font-semibold mb-2">
                    Conflicting Information
                  </AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium mb-1">Your assumption:</p>
                        <p className="text-xs">{contradiction.userClaim?.claim}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1">Research finding:</p>
                        <p className="text-xs">{contradiction.researchClaim?.claim}</p>
                      </div>
                      {contradiction.evidence && (
                        <div>
                          <p className="text-xs font-medium mb-1">Evidence:</p>
                          <p className="text-xs italic">{contradiction.evidence}</p>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Critical Gaps Section */}
        {criticalGaps.length > 0 && (
          <CollapsibleSection
            icon={AlertTriangle}
            title="Critical Gaps"
            count={criticalGaps.length}
            defaultOpen={true}
            variant="destructive"
          >
            <div className="space-y-2 mt-3">
              {criticalGaps.map((gap, index) => (
                <Alert key={index} data-testid={`gap-${index}`}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {gap}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </CardContent>
    </Card>
  );
}
