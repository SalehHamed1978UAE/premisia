import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface FiveWhysResultsProps {
  data: {
    rootCauses?: string[];
    whysPath?: string[];
    strategicImplications?: string[];
    tree?: any;
  };
}

export function FiveWhysResults({ data }: FiveWhysResultsProps) {
  const rootCauses = data.rootCauses || [];
  const strategicImplications = data.strategicImplications || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <div>
            <CardTitle>Root Causes Identified</CardTitle>
            <CardDescription>
              Five Whys analysis revealed fundamental issues
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rootCauses.length > 0 ? (
          <div className="space-y-3">
            {rootCauses.map((cause, idx) => (
              <div key={idx} className="flex gap-3">
                <Badge variant="outline" className="shrink-0 h-6">
                  {idx + 1}
                </Badge>
                <p className="text-sm text-foreground">{cause}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No root causes extracted
          </p>
        )}

        {strategicImplications.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-semibold mb-3">Strategic Implications</h4>
            <div className="space-y-2">
              {strategicImplications.map((implication, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <p className="text-sm text-foreground">{implication}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
