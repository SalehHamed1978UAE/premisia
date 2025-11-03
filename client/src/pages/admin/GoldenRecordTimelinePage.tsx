import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, Download, Copy, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type GoldenRecord = {
  id: string;
  journeyType: string;
  version: number;
  isCurrent: boolean;
  createdAt: string;
  createdBy: string;
  notes: string | null;
  steps: any[];
  metadata: any;
};

export default function GoldenRecordTimelinePage() {
  const { journeyType } = useParams<{ journeyType: string }>();
  const { isAdmin, isLoading: authLoading } = useRequireAdmin();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: records, isLoading } = useQuery<GoldenRecord[]>({
    queryKey: ['/api/admin/golden-records', { journeyType, includeHistory: true }],
    enabled: isAdmin && !!journeyType,
  });

  const promoteMutation = useMutation({
    mutationFn: async (version: number) => {
      return apiRequest('POST', `/api/admin/golden-records/${journeyType}/${version}/promote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/golden-records'] });
      toast({
        title: "Version promoted",
        description: "This version is now the current golden record",
      });
    },
    onError: () => {
      toast({
        title: "Promotion failed",
        description: "Unable to promote this version",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !isAdmin) {
    return null;
  }

  const sortedRecords = records?.sort((a, b) => b.version - a.version) || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => setLocation('/admin/golden-records')}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Golden Records
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold capitalize mb-2" data-testid="heading-journey-type">
          {journeyType?.replace(/_/g, ' ')}
        </h1>
        <p className="text-muted-foreground">
          Version history and timeline
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : sortedRecords.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No versions found for this journey type</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedRecords.map((record) => (
            <Card
              key={record.id}
              className={record.isCurrent ? "border-yellow-500 border-2" : ""}
              data-testid={`card-version-${record.version}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <span>Version {record.version}</span>
                      {record.isCurrent && (
                        <Badge variant="default" className="flex items-center gap-1" data-testid="badge-current">
                          <Star className="h-3 w-3" />
                          Current
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Created {formatDistanceToNow(new Date(record.createdAt), { addSuffix: true })}
                    </CardDescription>
                    {record.notes && (
                      <p className="mt-2 text-sm">{record.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/admin/golden-records/${journeyType}/${record.version}`)}
                      data-testid={`button-view-${record.version}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    {!record.isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => promoteMutation.mutate(record.version)}
                        disabled={promoteMutation.isPending}
                        data-testid={`button-promote-${record.version}`}
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Promote
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-clone-${record.version}`}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Clone
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-download-${record.version}`}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{record.steps?.length || 0} steps captured</span>
                  <span>•</span>
                  <span>Created by {record.createdBy}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
