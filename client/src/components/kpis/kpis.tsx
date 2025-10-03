import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertCircle,
  BarChart3,
  Activity,
  Calendar
} from "lucide-react";
import type { Kpi, KpiMeasurement } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export function KPIs() {
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  const { data: kpis, isLoading, error } = useQuery<Kpi[]>({
    queryKey: ['/api/kpis'],
  });

  const { data: measurements } = useQuery<KpiMeasurement[]>({
    queryKey: ['/api/kpis', selectedKpi, 'measurements'],
    enabled: !!selectedKpi,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-8 w-16 mb-4" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load KPIs. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusColor = (current: number, target: number) => {
    const percentage = target > 0 ? (current / target) * 100 : 0;
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (current: number, target: number) => {
    const percentage = target > 0 ? (current / target) * 100 : 0;
    if (percentage >= 90) return { label: 'Excellent', variant: 'default' as const, className: 'bg-green-100 text-green-800' };
    if (percentage >= 70) return { label: 'On Track', variant: 'default' as const, className: 'bg-blue-100 text-blue-800' };
    if (percentage >= 50) return { label: 'At Risk', variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Below Target', variant: 'destructive' as const };
  };

  const formatValue = (value: number, unit?: string | null) => {
    if (unit === '%') return `${value}%`;
    if (unit === '$') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    return value.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div></div>
        <Button data-testid="button-add-kpi">
          <Plus className="h-4 w-4 mr-2" />
          Add KPI
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPI Summary Cards */}
          {!kpis || kpis.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No KPIs configured</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Start tracking your program performance by adding your first KPI
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First KPI
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {kpis.map((kpi) => {
                const current = parseFloat(kpi.currentValue || '0');
                const target = parseFloat(kpi.targetValue || '0');
                const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
                const status = getStatusBadge(current, target);

                return (
                  <Card key={kpi.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedKpi(kpi.id)} data-testid={`kpi-card-${kpi.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-2 text-foreground">
                        {formatValue(current, kpi.unit)}
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-muted-foreground">
                          Target: {formatValue(target, kpi.unit)}
                        </span>
                        <Badge className={status.className}>
                          {status.label}
                        </Badge>
                      </div>

                      <Progress value={progress} className="h-2 mb-3" />

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {kpi.frequency} updates
                        </span>
                        <span className={`font-medium ${getStatusColor(current, target)}`}>
                          {progress.toFixed(1)}%
                        </span>
                      </div>

                      {kpi.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {kpi.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>KPI Trends</span>
              </CardTitle>
              <CardDescription>Performance trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Trend Visualization</h3>
                  <p className="text-muted-foreground mb-4">
                    Interactive charts showing KPI performance over time
                  </p>
                  <Badge variant="outline">Chart Integration Required</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All KPIs</CardTitle>
              <CardDescription>Detailed view of all tracked KPIs</CardDescription>
            </CardHeader>
            <CardContent>
              {!kpis || kpis.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No KPIs to display</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold text-foreground">KPI Name</th>
                        <th className="text-left p-4 font-semibold text-foreground">Current</th>
                        <th className="text-left p-4 font-semibold text-foreground">Target</th>
                        <th className="text-left p-4 font-semibold text-foreground">Progress</th>
                        <th className="text-left p-4 font-semibold text-foreground">Status</th>
                        <th className="text-left p-4 font-semibold text-foreground">Owner</th>
                        <th className="text-left p-4 font-semibold text-foreground">Frequency</th>
                        <th className="text-left p-4 font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.map((kpi) => {
                        const current = parseFloat(kpi.currentValue || '0');
                        const target = parseFloat(kpi.targetValue || '0');
                        const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
                        const status = getStatusBadge(current, target);

                        return (
                          <tr key={kpi.id} className="border-b hover:bg-accent/50" data-testid={`kpi-row-${kpi.id}`}>
                            <td className="p-4">
                              <div>
                                <p className="font-medium text-foreground">{kpi.name}</p>
                                {kpi.description && (
                                  <p className="text-sm text-muted-foreground">{kpi.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="p-4 font-medium text-foreground">
                              {formatValue(current, kpi.unit)}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {formatValue(target, kpi.unit)}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center space-x-2">
                                <Progress value={progress} className="w-16 h-2" />
                                <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge className={status.className}>
                                {status.label}
                              </Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {kpi.ownerId || 'Unassigned'}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {kpi.frequency}
                            </td>
                            <td className="p-4">
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm" data-testid={`edit-kpi-${kpi.id}`}>
                                  Edit
                                </Button>
                                <Button variant="ghost" size="sm" data-testid={`view-kpi-${kpi.id}`}>
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
