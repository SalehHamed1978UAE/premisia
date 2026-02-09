import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Shield, Clock, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CaptureGoldenRecordModal } from "@/components/admin/CaptureGoldenRecordModal";

type GoldenRecord = {
  id: string;
  journeyType: string;
  version: number;
  isCurrent: boolean;
  createdAt: string;
  createdBy: string;
  notes: string | null;
};

export default function GoldenRecordsListPage() {
  const { isAdmin, isLoading: authLoading } = useRequireAdmin();
  const [captureModalOpen, setCaptureModalOpen] = useState(false);

  const { data: records, isLoading } = useQuery<GoldenRecord[]>({
    queryKey: ['/api/admin/golden-records'],
    enabled: isAdmin,
  });

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Group records by journey type to show summary cards
  const journeyGroups = records?.reduce((acc, record) => {
    if (!acc[record.journeyType]) {
      acc[record.journeyType] = {
        journeyType: record.journeyType,
        currentVersion: null as GoldenRecord | null,
        totalVersions: 0,
        lastUpdated: null as string | null,
      };
    }
    acc[record.journeyType].totalVersions++;
    if (record.isCurrent) {
      acc[record.journeyType].currentVersion = record;
    }
    if (!acc[record.journeyType].lastUpdated || record.createdAt > acc[record.journeyType].lastUpdated!) {
      acc[record.journeyType].lastUpdated = record.createdAt;
    }
    return acc;
  }, {} as Record<string, { journeyType: string; currentVersion: GoldenRecord | null; totalVersions: number; lastUpdated: string | null }>);

  const journeyList = journeyGroups ? Object.values(journeyGroups) : [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-golden-records">
            <Shield className="h-8 w-8 text-yellow-600" />
            Golden Records
          </h1>
          <p className="text-muted-foreground mt-2">
            Versioned snapshots of the "golden path" for each strategic journey type
          </p>
        </div>
        <Button onClick={() => setCaptureModalOpen(true)} data-testid="button-capture-new">
          Capture Golden Record
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : journeyList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No golden records yet. Capture your first journey!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {journeyList.map((journey) => (
            <Link
              key={journey.journeyType}
              href={`/admin/golden-records/${journey.journeyType}`}
              data-testid={`card-journey-${journey.journeyType}`}
            >
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="capitalize">{journey.journeyType.replace(/_/g, ' ')}</span>
                    {journey.currentVersion && (
                      <Badge variant="default" data-testid={`badge-current-${journey.journeyType}`}>
                        v{journey.currentVersion.version}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <History className="h-3 w-3" />
                    {journey.totalVersions} version{journey.totalVersions !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Updated {journey.lastUpdated ? formatDistanceToNow(new Date(journey.lastUpdated), { addSuffix: true }) : 'never'}
                  </div>
                  {journey.currentVersion?.notes && (
                    <p className="mt-3 text-sm line-clamp-2 text-muted-foreground">
                      {journey.currentVersion.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CaptureGoldenRecordModal
        open={captureModalOpen}
        onOpenChange={setCaptureModalOpen}
      />
    </div>
  );
}
