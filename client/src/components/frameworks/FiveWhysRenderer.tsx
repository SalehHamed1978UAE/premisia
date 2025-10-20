import type { FC } from 'react';
import type { FiveWhysFrameworkResult } from '@shared/framework-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FrameworkRendererProps } from './index';

const FiveWhysRenderer: FC<FrameworkRendererProps<FiveWhysFrameworkResult>> = ({ data }) => {
  return (
    <Card data-testid="framework-five-whys">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>🎯</span>
              <span>Five Whys Analysis</span>
            </CardTitle>
            <CardDescription>Root Cause Investigation</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Problem Statement</h3>
            <p className="text-muted-foreground">{data.problem_statement}</p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm mb-1">Why #1: {data.why_1.question}</p>
              <p className="text-muted-foreground text-sm pl-4">{data.why_1.answer}</p>
            </div>
            <div>
              <p className="font-medium text-sm mb-1">Why #2: {data.why_2.question}</p>
              <p className="text-muted-foreground text-sm pl-4">{data.why_2.answer}</p>
            </div>
            <div>
              <p className="font-medium text-sm mb-1">Why #3: {data.why_3.question}</p>
              <p className="text-muted-foreground text-sm pl-4">{data.why_3.answer}</p>
            </div>
            <div>
              <p className="font-medium text-sm mb-1">Why #4: {data.why_4.question}</p>
              <p className="text-muted-foreground text-sm pl-4">{data.why_4.answer}</p>
            </div>
            <div>
              <p className="font-medium text-sm mb-1">Why #5: {data.why_5.question}</p>
              <p className="text-muted-foreground text-sm pl-4">{data.why_5.answer}</p>
            </div>
          </div>

          <div className="bg-primary/10 border-l-4 border-primary p-4">
            <h3 className="font-semibold mb-2">Root Cause</h3>
            <p className="text-foreground">{data.root_cause}</p>
          </div>

          {data.strategic_implications && data.strategic_implications.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Strategic Implications</h3>
              <ul className="list-disc list-inside space-y-1">
                {data.strategic_implications.map((implication, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">{implication}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FiveWhysRenderer;
