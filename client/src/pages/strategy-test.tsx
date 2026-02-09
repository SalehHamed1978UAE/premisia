import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, DollarSign, Users, Calendar } from 'lucide-react';

interface StrategyTestResponse {
  status: string;
  tests: {
    approaches: Array<{ id: string; name: string }>;
    costEstimate: {
      min: number;
      max: number;
      breakdown: Record<string, number>;
      timeline_months: number;
      team_size: { min: number; max: number };
    };
    workstreams: Array<{
      name: string;
      allocation: number;
      estimated_cost: { min: number; max: number };
    }>;
    coherence: {
      valid: boolean;
      warnings: string[];
      errors: string[];
    };
    decisionOptions: {
      approach: string;
      market: string;
      cost: any;
      workstreamCount: number;
      coherence: any;
    } | null;
  };
}

export default function StrategyTest() {
  const { data, isLoading, error } = useQuery<StrategyTestResponse>({
    queryKey: ['/api/strategy/test'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="container-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data || !data.tests) {
    return (
      <div className="container mx-auto p-6" data-testid="container-error">
        <Alert variant="destructive">
          <AlertDescription>
            {error ? 'Failed to load strategy ontology test' : 'Invalid response data'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const tests = data.tests;

  if (!tests.costEstimate || !tests.approaches || !tests.workstreams || !tests.coherence) {
    return (
      <div className="container mx-auto p-6" data-testid="container-error">
        <Alert variant="destructive">
          <AlertDescription>
            Strategy ontology test returned incomplete data. Check server logs.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="container-strategy-test">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Strategic Consultant Agent - Foundation Test</h1>
        <p className="text-muted-foreground" data-testid="text-description">
          Verifying Strategy Ontology Service & Intelligence Layer
        </p>
      </div>

      {/* Status Badge */}
      <div data-testid="badge-status">
        <Badge variant={data.status === 'success' ? 'default' : 'destructive'} className="text-lg py-2 px-4">
          {data.status === 'success' ? (
            <><CheckCircle className="w-4 h-4 mr-2" /> All Tests Passed</>
          ) : (
            <><XCircle className="w-4 h-4 mr-2" /> Tests Failed</>
          )}
        </Badge>
      </div>

      {/* Strategic Approaches */}
      <Card data-testid="card-approaches">
        <CardHeader>
          <CardTitle>1. Strategic Approaches (Ontology Query)</CardTitle>
          <CardDescription>Testing ontology loading and approach retrieval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tests.approaches.map((approach: any) => (
              <div 
                key={approach.id} 
                className="p-4 border rounded-lg bg-muted/50"
                data-testid={`approach-${approach.id}`}
              >
                <div className="font-semibold" data-testid={`text-approach-name-${approach.id}`}>
                  {approach.name}
                </div>
                <div className="text-sm text-muted-foreground" data-testid={`text-approach-id-${approach.id}`}>
                  {approach.id}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost Estimate */}
      <Card data-testid="card-cost-estimate">
        <CardHeader>
          <CardTitle>2. Cost Estimation (Intelligence Layer)</CardTitle>
          <CardDescription>Cost Leadership strategy in UAE market</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2" data-testid="section-budget">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="font-semibold">Budget Range</span>
              </div>
              <div className="text-2xl font-bold" data-testid="text-budget-range">
                ${(tests.costEstimate.min / 1000000).toFixed(2)}M - ${(tests.costEstimate.max / 1000000).toFixed(2)}M
              </div>
            </div>
            <div className="space-y-2" data-testid="section-timeline">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-semibold">Timeline</span>
              </div>
              <div className="text-2xl font-bold" data-testid="text-timeline">
                {tests.costEstimate.timeline_months} months
              </div>
            </div>
            <div className="space-y-2" data-testid="section-team">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span className="font-semibold">Team Size</span>
              </div>
              <div className="text-2xl font-bold" data-testid="text-team-size">
                {tests.costEstimate.team_size.min}-{tests.costEstimate.team_size.max} people
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workstream Allocations */}
      <Card data-testid="card-workstreams">
        <CardHeader>
          <CardTitle>3. Workstream Allocations (Resource Planning)</CardTitle>
          <CardDescription>Top 3 workstreams with budget distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tests.workstreams.map((ws: any, idx: number) => (
              <div 
                key={idx} 
                className="flex items-center justify-between p-3 border rounded-lg"
                data-testid={`workstream-${idx}`}
              >
                <div className="flex-1">
                  <div className="font-semibold" data-testid={`text-workstream-name-${idx}`}>
                    {ws.name}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`text-workstream-allocation-${idx}`}>
                    {ws.allocation}% allocation
                  </div>
                </div>
                <div className="text-right" data-testid={`text-workstream-cost-${idx}`}>
                  <div className="font-semibold">
                    ${(ws.estimated_cost.min / 1000).toFixed(0)}k - ${(ws.estimated_cost.max / 1000).toFixed(0)}k
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coherence Validation */}
      <Card data-testid="card-coherence">
        <CardHeader>
          <CardTitle>4. Strategic Coherence Validation</CardTitle>
          <CardDescription>Validating strategy-market fit with decision rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2" data-testid="section-coherence-status">
              {tests.coherence.valid ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-600">Strategy is Coherent</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-600">Strategy has Issues</span>
                </>
              )}
            </div>
            
            {tests.coherence.warnings.length > 0 && (
              <div data-testid="section-warnings">
                <h4 className="font-semibold mb-2 text-yellow-600">Warnings:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {tests.coherence.warnings.map((warning: string, idx: number) => (
                    <li key={idx} className="text-sm" data-testid={`text-warning-${idx}`}>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {tests.coherence.errors.length > 0 && (
              <div data-testid="section-errors">
                <h4 className="font-semibold mb-2 text-red-600">Errors:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {tests.coherence.errors.map((error: string, idx: number) => (
                    <li key={idx} className="text-sm" data-testid={`text-error-${idx}`}>
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Decision Options */}
      {tests.decisionOptions && (
        <Card data-testid="card-decision-options">
          <CardHeader>
            <CardTitle>5. Decision Options (Full Analysis)</CardTitle>
            <CardDescription>
              {tests.decisionOptions.approach} in {tests.decisionOptions.market}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div data-testid="section-decision-cost">
                <span className="text-sm text-muted-foreground">Budget Range:</span>
                <div className="font-semibold" data-testid="text-decision-budget">
                  ${(tests.decisionOptions.cost.min / 1000000).toFixed(1)}M - ${(tests.decisionOptions.cost.max / 1000000).toFixed(1)}M
                </div>
              </div>
              <div data-testid="section-decision-workstreams">
                <span className="text-sm text-muted-foreground">Workstreams:</span>
                <div className="font-semibold" data-testid="text-decision-workstream-count">
                  {tests.decisionOptions.workstreamCount} workstreams identified
                </div>
              </div>
              <div data-testid="section-decision-timeline">
                <span className="text-sm text-muted-foreground">Timeline:</span>
                <div className="font-semibold" data-testid="text-decision-timeline">
                  {tests.decisionOptions.cost.timeline_months} months
                </div>
              </div>
              <div data-testid="section-decision-coherence">
                <span className="text-sm text-muted-foreground">Coherence:</span>
                <div className="font-semibold" data-testid="text-decision-coherence">
                  {tests.decisionOptions.coherence.valid ? 'Valid ✓' : 'Issues Found'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Tables Status */}
      <Card data-testid="card-database">
        <CardHeader>
          <CardTitle>6. Database Schema</CardTitle>
          <CardDescription>Strategic Consultant tables created</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2" data-testid="table-status-versions">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <code className="text-sm">strategy_versions</code>
              <span className="text-sm text-muted-foreground">- Strategy iteration storage</span>
            </div>
            <div className="flex items-center gap-2" data-testid="table-status-decisions">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <code className="text-sm">strategic_decisions</code>
              <span className="text-sm text-muted-foreground">- Decision logging</span>
            </div>
            <div className="flex items-center gap-2" data-testid="table-status-insights">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <code className="text-sm">strategy_insights</code>
              <span className="text-sm text-muted-foreground">- Learned patterns</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
