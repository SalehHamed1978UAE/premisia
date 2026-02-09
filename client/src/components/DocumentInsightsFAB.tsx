import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import { useDocumentInsights } from "@/contexts/DocumentInsightsContext";

export function DocumentInsightsFAB() {
  const { pendingInsights, setPanelOpen } = useDocumentInsights();

  if (pendingInsights.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50"
      data-testid="fab-document-insights"
    >
      <Button
        onClick={() => setPanelOpen(true)}
        size="lg"
        className="rounded-full shadow-lg relative"
        data-testid="button-open-insights"
      >
        <Lightbulb className="h-5 w-5 mr-2" />
        Document Insights
        <Badge className="ml-2 bg-primary-foreground text-primary">
          {pendingInsights.length}
        </Badge>
      </Button>
    </div>
  );
}
