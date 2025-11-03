import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type StepDiff = {
  stepNumber: number;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  v1Step?: any;
  v2Step?: any;
  differences?: {
    field: string;
    v1Value: any;
    v2Value: any;
  }[];
};

type ComparisonResult = {
  journeyType: string;
  version1: number;
  version2: number;
  stepDiffs: StepDiff[];
  summary: {
    totalSteps: number;
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
};

type GoldenRecord = {
  id: string;
  journeyType: string;
  version: number;
  isCurrent: boolean;
};

export default function GoldenRecordComparePage() {
  const { journeyType, version } = useParams<{ journeyType: string; version: string }>();
  const { isAdmin, isLoading: authLoading } = useRequireAdmin();
  const [, setLocation] = useLocation();
  const [compareToVersion, setCompareToVersion] = useState<string>("");

  const { data: allVersions } = useQuery<GoldenRecord[]>({
    queryKey: ['/api/admin/golden-records', { journeyType, includeHistory: true }],
    enabled: isAdmin && !!journeyType,
  });

  const compareMutation = useMutation({
    mutationFn: async (targetVersion: string) => {
      const response = await apiRequest(
        'POST',
        `/api/admin/golden-records/${journeyType}/${version}/compare`,
        { compareToVersion: parseInt(targetVersion, 10) }
      );
      return response.json();
    },
  });

  const comparisonResult = compareMutation.data as ComparisonResult | undefined;

  const availableVersions = allVersions?.filter(v => v.version.toString() !== version) || [];

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const handleCompare = () => {
    if (compareToVersion) {
      compareMutation.mutate(compareToVersion);
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'added': return 'bg-green-50 border-green-200';
      case 'removed': return 'bg-red-50 border-red-200';
      case 'modified': return 'bg-yellow-50 border-yellow-200';
      default: return '';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <Button
        variant="ghost"
        onClick={() => setLocation(`/admin/golden-records/${journeyType}/${version}`)}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Detail
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4" data-testid="heading-compare">
          Compare Versions
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Select Versions to Compare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Base Version</label>
                <div className="bg-muted px-4 py-2 rounded">
                  <span className="font-mono">v{version}</span>
                </div>
              </div>
              <ArrowLeftRight className="h-6 w-6 text-muted-foreground mt-6" />
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Compare To</label>
                <Select value={compareToVersion} onValueChange={setCompareToVersion}>
                  <SelectTrigger data-testid="select-compare-version">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVersions.map((v) => (
                      <SelectItem key={v.version} value={v.version.toString()}>
                        v{v.version} {v.isCurrent && '(Current)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCompare}
                disabled={!compareToVersion || compareMutation.isPending}
                className="mt-6"
                data-testid="button-run-compare"
              >
                Compare
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {compareMutation.isPending && (
        <Card className="animate-pulse">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Comparing versions...</p>
          </CardContent>
        </Card>
      )}

      {comparisonResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparison Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{comparisonResult.summary.totalSteps}</div>
                  <div className="text-sm text-muted-foreground">Total Steps</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{comparisonResult.summary.added}</div>
                  <div className="text-sm text-muted-foreground">Added</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{comparisonResult.summary.removed}</div>
                  <div className="text-sm text-muted-foreground">Removed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{comparisonResult.summary.modified}</div>
                  <div className="text-sm text-muted-foreground">Modified</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">{comparisonResult.summary.unchanged}</div>
                  <div className="text-sm text-muted-foreground">Unchanged</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step-by-Step Comparison</h2>
            {comparisonResult.stepDiffs.map((diff, index) => (
              <Card
                key={index}
                className={getChangeColor(diff.changeType)}
                data-testid={`diff-step-${diff.stepNumber}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline">Step {diff.stepNumber}</Badge>
                      {diff.v1Step?.stepName || diff.v2Step?.stepName}
                    </CardTitle>
                    <Badge
                      variant={diff.changeType === 'unchanged' ? 'secondary' : 'default'}
                      data-testid={`badge-change-${diff.stepNumber}`}
                    >
                      {diff.changeType}
                    </Badge>
                  </div>
                </CardHeader>
                {diff.changeType !== 'unchanged' && (
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">v{version}</h4>
                        {diff.v1Step ? (
                          <pre className="bg-white dark:bg-gray-100 text-gray-900 p-3 rounded text-xs overflow-x-auto max-h-48">
                            {JSON.stringify(diff.v1Step, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Step not present</p>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">v{compareToVersion}</h4>
                        {diff.v2Step ? (
                          <pre className="bg-white dark:bg-gray-100 text-gray-900 p-3 rounded text-xs overflow-x-auto max-h-48">
                            {JSON.stringify(diff.v2Step, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Step not present</p>
                        )}
                      </div>
                    </div>
                    {diff.differences && diff.differences.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Field Differences</h4>
                        <div className="space-y-2">
                          {diff.differences.map((fieldDiff, idx) => (
                            <div key={idx} className="text-sm border-l-2 border-yellow-500 pl-3" data-testid={`field-diff-${diff.stepNumber}-${idx}`}>
                              <span className="font-medium">{fieldDiff.field}:</span>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                  <span className="text-xs text-gray-600 dark:text-gray-400">Old: </span>
                                  <code className="text-xs text-gray-900 dark:text-gray-100">{JSON.stringify(fieldDiff.v1Value)}</code>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                  <span className="text-xs text-gray-600 dark:text-gray-400">New: </span>
                                  <code className="text-xs text-gray-900 dark:text-gray-100">{JSON.stringify(fieldDiff.v2Value)}</code>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
