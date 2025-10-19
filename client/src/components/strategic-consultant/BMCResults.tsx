import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

interface BMCResultsProps {
  data: {
    blocks?: Record<string, any>;
    criticalGaps?: string[];
    contradictions?: any[];
  };
}

export function BMCResults({ data }: BMCResultsProps) {
  const blocks = data.blocks || {};
  const criticalGaps = data.criticalGaps || [];
  const blockNames = Object.keys(blocks);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-blue-600" />
          <div>
            <CardTitle>Business Model Insights</CardTitle>
            <CardDescription>
              Business Model Canvas analysis identified {blockNames.length} key areas
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {blockNames.length > 0 ? (
          <div className="space-y-4">
            {blockNames.slice(0, 3).map((blockName) => {
              const block = blocks[blockName];
              const summary = block?.summary || block?.insights?.[0] || 'No insights available';
              
              return (
                <div key={blockName} className="border-l-2 border-blue-200 pl-4">
                  <h4 className="text-sm font-semibold capitalize mb-1">
                    {blockName.replace(/_/g, ' ')}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {typeof summary === 'string' ? summary : JSON.stringify(summary)}
                  </p>
                </div>
              );
            })}
            
            {blockNames.length > 3 && (
              <p className="text-xs text-muted-foreground italic">
                + {blockNames.length - 3} more areas analyzed
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No business model blocks generated
          </p>
        )}

        {criticalGaps.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-semibold mb-3">Critical Gaps</h4>
            <div className="space-y-2">
              {criticalGaps.map((gap, idx) => (
                <div key={idx} className="flex gap-3">
                  <Badge variant="destructive" className="shrink-0 h-6">
                    Gap {idx + 1}
                  </Badge>
                  <p className="text-sm text-foreground">{gap}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
