import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Rocket, Calendar, BookOpen, TrendingUp, FileText, Plus, ExternalLink } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface StrategicUnderstanding {
  id: string;
  sessionId: string;
  userInput: string;
  title: string | null;
  initiativeType: string | null;
  initiativeDescription: string | null;
  strategyMetadata: any;
  createdAt: Date;
  updatedAt: Date;
}

interface JourneySession {
  id: string;
  understandingId: string;
  userId: string;
  journeyType: string;
  status: string;
  currentFrameworkIndex: number;
  completedFrameworks: string[];
  versionNumber: number;
  background: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

interface EPMProgram {
  id: string;
  userId: string;
  frameworkType: string;
  status: string;
  createdAt: Date;
  strategyVersionId: string;
}

interface Reference {
  id: string;
  sourceType: string;
  title: string;
  url: string | null;
  description: string | null;
  topics: string[];
  confidence: number | null;
  extractedQuotes: any[];
  usedInComponents: string[];
  origin: string;
  createdAt: Date;
}

interface StrategyDetail {
  understanding: StrategicUnderstanding;
  sessions: JourneySession[];
  programs: EPMProgram[];
  referenceCount: number;
}

function OverviewTab({ strategy }: { strategy: StrategyDetail }) {
  const metadata = strategy.understanding.strategyMetadata || {};
  const availableFrameworks = (metadata.completedFrameworks || []).length;
  const availableReferences = metadata.availableReferences || 0;
  const confidence = metadata.confidence || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Strategic Understanding</CardTitle>
          <CardDescription>Core initiative details and classification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Title</h4>
            <p data-testid="text-strategy-title">
              {strategy.understanding.title || strategy.understanding.initiativeDescription || "Untitled Strategy"}
            </p>
          </div>
          
          {strategy.understanding.initiativeType && (
            <div>
              <h4 className="font-semibold mb-2">Initiative Type</h4>
              <Badge variant="outline" className="capitalize" data-testid="badge-initiative-type">
                {strategy.understanding.initiativeType.replace(/_/g, ' ')}
              </Badge>
            </div>
          )}
          
          <div>
            <h4 className="font-semibold mb-2">Original Input</h4>
            <p className="text-muted-foreground" data-testid="text-user-input">
              {strategy.understanding.userInput}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Journeys</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-journeys">
              {strategy.sessions.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Frameworks</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-frameworks">
              {availableFrameworks}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>References</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-references">
              {strategy.referenceCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>EPM Programs</CardDescription>
            <CardTitle className="text-2xl" data-testid="stat-programs">
              {strategy.programs.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {confidence > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Readiness Assessment</CardTitle>
            <CardDescription>Strategic context confidence level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Confidence</span>
                <span className="text-sm font-medium" data-testid="text-confidence">
                  {(confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              {confidence >= 0.6 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  ✓ Ready for background execution
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function JourneyTimelineTab({ sessions }: { sessions: JourneySession[] }) {
  const statusColor = {
    'initializing': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'in_progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'failed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className="space-y-4">
      {sessions.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No journeys yet</h3>
          <p className="text-muted-foreground">Start a strategic journey to see it here</p>
        </Card>
      ) : (
        sessions.map((session) => (
          <Card key={session.id} data-testid={`card-journey-${session.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-lg" data-testid={`text-journey-version-${session.id}`}>
                      Version {session.versionNumber}
                    </CardTitle>
                    <Badge
                      className={statusColor[session.status as keyof typeof statusColor] || statusColor.initializing}
                      data-testid={`badge-journey-status-${session.id}`}
                    >
                      {session.status.replace(/_/g, ' ')}
                    </Badge>
                    {session.background && (
                      <Badge variant="outline" data-testid={`badge-background-${session.id}`}>
                        Background
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="capitalize">
                    {session.journeyType.replace(/_/g, ' ')} Journey
                  </CardDescription>
                </div>
                <Link href={`/strategic-consultant/journey-results/${session.id}`}>
                  <a>
                    <Button variant="ghost" size="sm" data-testid={`button-view-journey-${session.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Completed Frameworks</p>
                  <div className="flex flex-wrap gap-2">
                    {session.completedFrameworks.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None yet</span>
                    ) : (
                      session.completedFrameworks.map((framework, idx) => (
                        <Badge key={idx} variant="secondary" className="capitalize" data-testid={`badge-framework-${idx}`}>
                          {framework.replace(/_/g, ' ')}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span data-testid={`text-created-${session.id}`}>
                    Started {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </span>
                  {session.completedAt && (
                    <span data-testid={`text-completed-${session.id}`}>
                      Completed {format(new Date(session.completedAt), 'MMM dd, yyyy')}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function ResearchLibraryTab({ strategyId }: { strategyId: string }) {
  const { data: references, isLoading } = useQuery<Reference[]>({
    queryKey: ['/api/strategies', strategyId, 'references'],
  });

  const confidenceColor = (conf: number | null) => {
    if (!conf) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    if (conf >= 0.7) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (conf >= 0.4) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!references || references.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No research references</h3>
          <p className="text-muted-foreground">Research sources will appear here as you complete frameworks</p>
        </Card>
      ) : (
        references.map((ref) => (
          <Card key={ref.id} data-testid={`card-reference-${ref.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base mb-2" data-testid={`text-reference-title-${ref.id}`}>
                    {ref.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize" data-testid={`badge-source-type-${ref.id}`}>
                      {ref.sourceType}
                    </Badge>
                    {ref.confidence !== null && (
                      <Badge className={confidenceColor(ref.confidence)} data-testid={`badge-confidence-${ref.id}`}>
                        {(ref.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    )}
                    <Badge variant="secondary" data-testid={`badge-origin-${ref.id}`}>
                      {ref.origin.replace(/_/g, ' ')}
                    </Badge>
                  </CardDescription>
                </div>
                {ref.url && (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" data-testid={`link-reference-${ref.id}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ref.description && (
                <p className="text-sm text-muted-foreground" data-testid={`text-description-${ref.id}`}>
                  {ref.description}
                </p>
              )}
              
              {ref.topics && ref.topics.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {ref.topics.map((topic, idx) => (
                      <Badge key={idx} variant="outline" data-testid={`badge-topic-${idx}`}>
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {ref.usedInComponents && ref.usedInComponents.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Used In</p>
                  <div className="flex flex-wrap gap-2">
                    {ref.usedInComponents.map((component, idx) => (
                      <Badge key={idx} variant="secondary" className="font-mono text-xs" data-testid={`badge-component-${idx}`}>
                        {component}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {ref.extractedQuotes && ref.extractedQuotes.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Extracted Quotes</p>
                  <div className="space-y-2">
                    {ref.extractedQuotes.slice(0, 3).map((quote: any, idx) => (
                      <blockquote key={idx} className="pl-4 border-l-2 border-muted text-sm italic" data-testid={`quote-${idx}`}>
                        {quote.snippet}
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function EPMProgramsTab({ programs }: { programs: EPMProgram[] }) {
  return (
    <div className="space-y-4">
      {programs.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No EPM programs yet</h3>
          <p className="text-muted-foreground">Complete a strategic journey to generate EPM programs</p>
        </Card>
      ) : (
        programs.map((program) => (
          <Card key={program.id} data-testid={`card-program-${program.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-lg capitalize" data-testid={`text-program-framework-${program.id}`}>
                      {program.frameworkType.replace(/_/g, ' ')} Program
                    </CardTitle>
                    <Badge variant="outline" className="capitalize" data-testid={`badge-program-status-${program.id}`}>
                      {program.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    Created {formatDistanceToNow(new Date(program.createdAt), { addSuffix: true })}
                  </CardDescription>
                </div>
                <Link href={`/strategy-workspace/epm/${program.id}`}>
                  <a>
                    <Button variant="default" size="sm" data-testid={`button-view-program-${program.id}`}>
                      View Program
                    </Button>
                  </a>
                </Link>
              </div>
            </CardHeader>
          </Card>
        ))
      )}
    </div>
  );
}

export default function StrategyDetailPage() {
  const [, params] = useRoute("/strategies/:id");
  const strategyId = params?.id;

  const { data: strategy, isLoading, error } = useQuery<StrategyDetail>({
    queryKey: ['/api/strategies', strategyId],
    enabled: !!strategyId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card className="p-8 text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Strategy not found</h3>
          <p className="text-muted-foreground mb-4">The strategy you're looking for doesn't exist or you don't have access to it.</p>
          <Link href="/strategies">
            <a>
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Strategies
              </Button>
            </a>
          </Link>
        </Card>
      </div>
    );
  }

  const displayTitle = strategy.understanding.title || strategy.understanding.initiativeDescription || "Untitled Strategy";

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8" data-testid="page-strategy-detail">
      {/* Header */}
      <div className="mb-6">
        <Link href="/strategies">
          <a>
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Strategies
            </Button>
          </a>
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="heading-strategy-title">
                {displayTitle}
              </h1>
              {strategy.understanding.initiativeType && (
                <Badge variant="outline" className="capitalize">
                  {strategy.understanding.initiativeType.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
          </div>
          <Link href={`/strategic-consultant/input?understandingId=${strategyId}`}>
            <a>
              <Button data-testid="button-new-journey">
                <Plus className="h-4 w-4 mr-2" />
                Start New Journey
              </Button>
            </a>
          </Link>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-strategy-detail">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="journeys" data-testid="tab-journeys">
            Journeys ({strategy.sessions.length})
          </TabsTrigger>
          <TabsTrigger value="research" data-testid="tab-research">
            Research ({strategy.referenceCount})
          </TabsTrigger>
          <TabsTrigger value="programs" data-testid="tab-programs">
            EPM Programs ({strategy.programs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab strategy={strategy} />
        </TabsContent>

        <TabsContent value="journeys">
          <JourneyTimelineTab sessions={strategy.sessions} />
        </TabsContent>

        <TabsContent value="research">
          <ResearchLibraryTab strategyId={strategyId!} />
        </TabsContent>

        <TabsContent value="programs">
          <EPMProgramsTab programs={strategy.programs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
