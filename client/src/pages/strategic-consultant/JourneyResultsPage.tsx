import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { FiveWhysResults } from "@/components/strategic-consultant/FiveWhysResults";
import { BMCResults } from "@/components/strategic-consultant/BMCResults";

export default function JourneyResultsPage() {
  const [, setLocation] = useLocation();
  const { sessionId } = useParams<{ sessionId: string }>();

  // Fetch journey results from API
  const { data: journeyResults, isLoading, error } = useQuery({
    queryKey: ['/api/strategic-consultant/journeys', sessionId, 'results'],
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <AppLayout
        title="Journey Complete"
        subtitle="Loading your results..."
        onViewChange={() => setLocation('/')}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading journey results...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !journeyResults) {
    return (
      <AppLayout
        title="Journey Complete"
        subtitle="Error loading results"
        onViewChange={() => setLocation('/')}
      >
        <div className="max-w-2xl mx-auto">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                {(error as any)?.message || 'Failed to load journey results'}
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation('/strategic-consultant/input')}
                className="mt-4"
              >
                Start New Analysis
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const completedFrameworks = (journeyResults as any)?.completedFrameworks || [];
  const context = (journeyResults as any)?.context || {};
  const journeyType = (journeyResults as any)?.journeyType;
  const status = (journeyResults as any)?.status;
  const insights = context.insights || {};

  // Map framework names to display names
  const frameworkDisplayNames: Record<string, string> = {
    'five_whys': 'Five Whys',
    'bmc': 'Business Model Canvas',
    'porters': "Porter's Five Forces",
    'pestle': 'PESTLE Analysis',
  };

  return (
    <AppLayout
      title="Journey Complete"
      subtitle="Review your strategic analysis results"
      onViewChange={() => setLocation('/')}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Completion Banner */}
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Strategic Analysis Complete!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your multi-framework journey has been completed successfully.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Frameworks Completed */}
        {completedFrameworks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Frameworks Completed</CardTitle>
              <CardDescription>
                Your analysis was processed through the following strategic frameworks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {completedFrameworks.map((framework: string) => (
                  <Badge key={framework} variant="default" className="text-sm">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {frameworkDisplayNames[framework] || framework}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dynamic Framework Results */}
        <div className="space-y-6">
          {completedFrameworks.includes('five_whys') && (
            <FiveWhysResults data={insights} />
          )}

          {completedFrameworks.includes('bmc') && (
            <BMCResults data={insights} />
          )}

          {/* Add more framework components as they become available */}
          {/* {completedFrameworks.includes('porters') && <PortersResults data={insights} />} */}
          {/* {completedFrameworks.includes('pestle') && <PESTLEResults data={insights} />} */}
        </div>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setLocation('/repository')}
              className="w-full justify-between"
              data-testid="button-view-repository"
            >
              View in Repository
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation('/strategic-consultant/input')}
              className="w-full"
              data-testid="button-new-analysis"
            >
              Start New Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
