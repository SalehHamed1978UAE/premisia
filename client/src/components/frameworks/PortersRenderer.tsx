import type { FC } from 'react';
import type { PortersFrameworkResult } from '@shared/framework-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, AlertTriangle } from "lucide-react";
import type { FrameworkRendererProps } from './index';

const forceCategories = [
  { key: 'competitive_rivalry', label: 'Competitive Rivalry' },
  { key: 'supplier_power', label: 'Supplier Power' },
  { key: 'buyer_power', label: 'Buyer Power' },
  { key: 'threat_of_substitution', label: 'Threat of Substitution' },
  { key: 'threat_of_new_entry', label: 'Threat of New Entry' },
];

const getLevelColor = (level: string) => {
  switch (level?.toLowerCase()) {
    case 'high': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    default: return 'outline';
  }
};

const getConfidenceColor = (confidence: string) => {
  switch (confidence?.toLowerCase()) {
    case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'low': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const PortersRenderer: FC<FrameworkRendererProps<PortersFrameworkResult>> = ({ data }) => {
  return (
    <div className="space-y-6" data-testid="framework-porters">
      <Card>
        <CardHeader>
          <CardTitle>Porter's Five Forces Analysis</CardTitle>
          <CardDescription>
            Overall Market Attractiveness: <Badge variant={getLevelColor(data.overall_attractiveness)} data-testid="badge-overall-attractiveness">
              {data.overall_attractiveness}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {forceCategories.map(({ key, label }) => {
            const force = data[key as keyof typeof data] as any;
            if (!force || key === 'overall_attractiveness' || key === 'key_strategic_priorities') return null;
            
            return (
              <div key={key} className="space-y-3 border-l-4 border-primary/20 pl-4" data-testid={`section-porter-${key}`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">{label}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={getLevelColor(force.level)} data-testid={`badge-level-${key}`}>{force.level}</Badge>
                    {force.confidence && (
                      <Badge className={getConfidenceColor(force.confidence)} data-testid={`badge-confidence-${key}`}>
                        {force.confidence} confidence
                      </Badge>
                    )}
                  </div>
                </div>

                {force.insufficientData && (
                  <Alert variant="default" className="border-yellow-500" data-testid={`alert-insufficient-${key}`}>
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle>Insufficient Data</AlertTitle>
                    <AlertDescription>
                      Limited research data available for this force. Analysis may be less comprehensive.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Key Factors:</p>
                  <ul className="space-y-2">
                    {force.factors.map((factorObj: any, idx: number) => {
                      const factorText = typeof factorObj === 'string' ? factorObj : factorObj.factor;
                      const citations = typeof factorObj === 'object' ? factorObj.citations : [];
                      
                      return (
                        <li key={idx} className="text-sm">
                          <div className="flex items-start gap-2">
                            <span className="flex-1">{factorText}</span>
                            {citations && citations.length > 0 && (
                              <div className="flex gap-1">
                                {citations.map((citation: string, citIdx: number) => (
                                  <a
                                    key={citIdx}
                                    href={citation}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                    data-testid={`link-citation-${key}-${idx}-${citIdx}`}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="bg-secondary/50 p-3 rounded-md">
                  <p className="text-sm">
                    <span className="font-medium">Strategic Response: </span>
                    {force.strategic_response}
                  </p>
                </div>
              </div>
            );
          })}

          {data.key_strategic_priorities && data.key_strategic_priorities.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-2">Key Strategic Priorities</h4>
              <ul className="list-decimal list-inside space-y-1">
                {data.key_strategic_priorities.map((priority, idx) => (
                  <li key={idx} className="text-muted-foreground" data-testid={`text-priority-${idx}`}>
                    {priority}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortersRenderer;
