import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDocumentInsights } from "@/contexts/DocumentInsightsContext";
import { FileText, Eye, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function DocumentInsightsPanel() {
  const { pendingInsights, isPanelOpen, setPanelOpen, dismissNotification, openInsights } =
    useDocumentInsights();

  return (
    <Sheet open={isPanelOpen} onOpenChange={setPanelOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="panel-document-insights">
        <SheetHeader>
          <SheetTitle>Document Insights</SheetTitle>
          <SheetDescription>
            Knowledge extracted from your uploaded documents
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {pendingInsights.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No new insights available</p>
            </div>
          ) : (
            pendingInsights.map((insight) => (
              <Card key={insight.id} data-testid={`insight-card-${insight.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {insight.fileName || 'Document'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {formatDistanceToNow(new Date(insight.completedAt), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => dismissNotification(insight.id)}
                      data-testid={`button-dismiss-${insight.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {insight.entityCount} statement{insight.entityCount !== 1 ? 's' : ''} extracted
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => openInsights(insight.understandingId)}
                      data-testid={`button-view-${insight.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View in Knowledge Graph
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
