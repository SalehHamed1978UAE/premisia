import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface JourneyResultsProps {
  context: any;
  journeyType: string;
}

export default function JourneyResultsPage() {
  const [, setLocation] = useLocation();
  const { sessionId } = useParams<{ sessionId: string }>();

  // In real implementation, fetch journey results from API
  // For now, this is a placeholder

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
        <Card>
          <CardHeader>
            <CardTitle>Frameworks Completed</CardTitle>
            <CardDescription>
              Your analysis was processed through the following strategic frameworks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Five Whys
              </Badge>
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Business Model Canvas
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Key Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Strategic Insights</CardTitle>
            <CardDescription>
              Accumulated insights from your journey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Root Causes Identified</h4>
              <p className="text-sm text-muted-foreground">
                Analysis revealed fundamental issues affecting your business model...
              </p>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="text-sm font-semibold mb-2">Business Model Insights</h4>
              <p className="text-sm text-muted-foreground">
                Key gaps and opportunities were identified across value propositions, customer segments, and revenue streams...
              </p>
            </div>
          </CardContent>
        </Card>

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
