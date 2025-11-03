import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Eye, Code, Database, FileImage } from "lucide-react";
import { format } from "date-fns";

type GoldenRecordStep = {
  stepNumber: number;
  stepName: string;
  expectedUrl: string;
  screenshotPath?: string;
  requestPayload?: any;
  responsePayload?: any;
  dbSnapshot?: any;
  observations?: string;
};

type GoldenRecord = {
  id: string;
  journeyType: string;
  version: number;
  isCurrent: boolean;
  createdAt: string;
  createdBy: string;
  notes: string | null;
  steps: GoldenRecordStep[];
  metadata: any;
};

export default function GoldenRecordDetailPage() {
  const { journeyType, version } = useParams<{ journeyType: string; version: string }>();
  const { isAdmin, isLoading: authLoading } = useRequireAdmin();
  const [, setLocation] = useLocation();

  const { data: record, isLoading } = useQuery<GoldenRecord>({
    queryKey: ['/api/admin/golden-records', journeyType, version],
    enabled: isAdmin && !!journeyType && !!version,
  });

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <Button
        variant="ghost"
        onClick={() => setLocation(`/admin/golden-records/${journeyType}`)}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Timeline
      </Button>

      {isLoading ? (
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
        </Card>
      ) : !record ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Golden record not found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold capitalize" data-testid="heading-detail">
                  {record.journeyType.replace(/_/g, ' ')} v{record.version}
                </h1>
                {record.isCurrent && (
                  <Badge variant="default" data-testid="badge-current">Current</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Created {format(new Date(record.createdAt), 'PPpp')} by {record.createdBy}
              </p>
              {record.notes && (
                <p className="mt-2 text-sm">{record.notes}</p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation(`/admin/golden-records/${journeyType}/${version}/compare`)}
              data-testid="button-compare"
            >
              Compare Versions
            </Button>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Journey Steps ({record.steps?.length || 0})</h2>
            {record.steps?.map((step, index) => (
              <Card key={index} data-testid={`step-card-${step.stepNumber}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline">{step.stepNumber}</Badge>
                    {step.stepName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview" data-testid={`tab-overview-${step.stepNumber}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Overview
                      </TabsTrigger>
                      <TabsTrigger value="payloads" data-testid={`tab-payloads-${step.stepNumber}`}>
                        <Code className="h-4 w-4 mr-2" />
                        Payloads
                      </TabsTrigger>
                      <TabsTrigger value="database" data-testid={`tab-database-${step.stepNumber}`}>
                        <Database className="h-4 w-4 mr-2" />
                        Database
                      </TabsTrigger>
                      <TabsTrigger value="screenshot" data-testid={`tab-screenshot-${step.stepNumber}`}>
                        <FileImage className="h-4 w-4 mr-2" />
                        Screenshot
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Expected URL</h4>
                        <code className="bg-muted px-3 py-2 rounded block text-sm" data-testid={`url-${step.stepNumber}`}>
                          {step.expectedUrl}
                        </code>
                      </div>
                      {step.observations && (
                        <div>
                          <h4 className="font-semibold mb-2">Observations</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid={`observations-${step.stepNumber}`}>
                            {step.observations}
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="payloads" className="space-y-4">
                      {step.requestPayload && (
                        <div>
                          <h4 className="font-semibold mb-2">Request Payload (Sanitized)</h4>
                          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto" data-testid={`request-${step.stepNumber}`}>
                            {JSON.stringify(step.requestPayload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {step.responsePayload && (
                        <div>
                          <h4 className="font-semibold mb-2">Response Payload (Sanitized)</h4>
                          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto max-h-96" data-testid={`response-${step.stepNumber}`}>
                            {JSON.stringify(step.responsePayload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="database" className="space-y-4">
                      {step.dbSnapshot ? (
                        <div>
                          <h4 className="font-semibold mb-2">Database Snapshot (Encrypted & Sanitized)</h4>
                          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto max-h-96" data-testid={`db-snapshot-${step.stepNumber}`}>
                            {JSON.stringify(step.dbSnapshot, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No database snapshot captured for this step</p>
                      )}
                    </TabsContent>

                    <TabsContent value="screenshot" className="space-y-4">
                      {step.screenshotPath ? (
                        <div>
                          <img
                            src={`/${step.screenshotPath}`}
                            alt={`Screenshot for ${step.stepName}`}
                            className="rounded border max-w-full"
                            data-testid={`screenshot-${step.stepNumber}`}
                          />
                          <p className="text-xs text-muted-foreground mt-2">{step.screenshotPath}</p>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                          <FileImage className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-4">No screenshot uploaded</p>
                          <Button variant="outline" size="sm" data-testid={`button-upload-${step.stepNumber}`}>
                            Upload Screenshot
                          </Button>
                          <p className="text-xs text-muted-foreground mt-2">
                            Expected path: golden-records/{record.journeyType}/v{record.version}/{step.stepNumber}.png
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
