import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useProgram } from "@/contexts/ProgramContext";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function KPIs() {
  const { toast } = useToast();
  const { selectedProgramId } = useProgram();
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [kpiForm, setKpiForm] = useState({
    name: "",
    description: "",
    targetValue: "",
    currentValue: "",
    unit: "",
    frequency: "Monthly"
  });

  const { data: kpis, isLoading, error } = useQuery<Kpi[]>({
    queryKey: ['/api/kpis', selectedProgramId],
    queryFn: async () => {
      if (!selectedProgramId) return [];
      const res = await fetch(`/api/kpis?programId=${selectedProgramId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch KPIs');
      return res.json();
    },
    enabled: !!selectedProgramId,
  });

  const { data: measurements } = useQuery<KpiMeasurement[]>({
    queryKey: ['/api/kpis', selectedKpi, 'measurements'],
    queryFn: async () => {
      if (!selectedKpi) return [];
      const res = await fetch(`/api/kpis/${selectedKpi}/measurements`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch measurements');
      return res.json();
    },
    enabled: !!selectedKpi,
  });

  const createKpiMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        programId: selectedProgramId,
        name: data.name,
        description: data.description || null,
        targetValue: data.targetValue || null,
        currentValue: data.currentValue || "0",
        unit: data.unit || null,
        frequency: data.frequency || "Monthly",
        ownerId: null,
      };
      return apiRequest('/api/kpis', 'POST', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/kpis', selectedProgramId] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/summary', selectedProgramId] });
      setKpiDialogOpen(false);
      setKpiForm({
        name: "",
        description: "",
        targetValue: "",
        currentValue: "",
        unit: "",
        frequency: "Monthly"
      });
      toast({ title: "KPI added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create KPI", variant: "destructive" });
    }
  });

  if (!selectedProgramId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please select a program from the dropdown above to view KPI data.
        </AlertDescription>
      </Alert>
    );
  }

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
        <Button onClick={() => setKpiDialogOpen(true)} data-testid="button-add-kpi">
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
                <Button onClick={() => setKpiDialogOpen(true)} data-testid="button-add-first-kpi">
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
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium">Select KPI:</Label>
                <Select value={selectedKpi || ''} onValueChange={setSelectedKpi}>
                  <SelectTrigger className="w-[300px]" data-testid="select-kpi-trend">
                    <SelectValue placeholder="Choose a KPI to view trends" />
                  </SelectTrigger>
                  <SelectContent>
                    {kpis?.map((kpi) => (
                      <SelectItem key={kpi.id} value={kpi.id} data-testid={`select-kpi-option-${kpi.id}`}>
                        {kpi.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedKpi ? (
                <div className="h-96 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Select a KPI</h3>
                    <p className="text-muted-foreground">
                      Choose a KPI from the dropdown above to view its trend over time
                    </p>
                  </div>
                </div>
              ) : !measurements || measurements.length === 0 ? (
                <div className="h-96 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                  <div className="text-center">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Measurements</h3>
                    <p className="text-muted-foreground">
                      No measurement data available for this KPI yet
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-96" data-testid="kpi-trend-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={measurements.map(m => ({
                      date: new Date(m.measurementDate).toLocaleDateString(),
                      value: parseFloat(m.value),
                      target: parseFloat(kpis?.find(k => k.id === selectedKpi)?.targetValue || '0')
                    }))} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Actual Value" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Target" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
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
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="min-w-full">
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

      {/* KPI Creation Dialog */}
      <Dialog open={kpiDialogOpen} onOpenChange={setKpiDialogOpen}>
        <DialogContent data-testid="dialog-add-kpi">
          <DialogHeader>
            <DialogTitle>Add New KPI</DialogTitle>
            <DialogDescription>Create a new key performance indicator to track program success</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">KPI Name *</Label>
              <Input
                id="name"
                value={kpiForm.name}
                onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                placeholder="e.g., Customer Satisfaction Score"
                data-testid="input-kpi-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={kpiForm.description}
                onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                placeholder="Brief description of this KPI"
                data-testid="input-kpi-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="targetValue">Target Value</Label>
                <Input
                  id="targetValue"
                  type="number"
                  value={kpiForm.targetValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, targetValue: e.target.value })}
                  placeholder="e.g., 95"
                  data-testid="input-kpi-target"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currentValue">Current Value</Label>
                <Input
                  id="currentValue"
                  type="number"
                  value={kpiForm.currentValue}
                  onChange={(e) => setKpiForm({ ...kpiForm, currentValue: e.target.value })}
                  placeholder="e.g., 0"
                  data-testid="input-kpi-current"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={kpiForm.unit}
                  onValueChange={(value) => setKpiForm({ ...kpiForm, unit: value })}
                >
                  <SelectTrigger id="unit" data-testid="select-kpi-unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">Percentage (%)</SelectItem>
                    <SelectItem value="$">Currency ($)</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  value={kpiForm.frequency}
                  onValueChange={(value) => setKpiForm({ ...kpiForm, frequency: value })}
                >
                  <SelectTrigger id="frequency" data-testid="select-kpi-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpiDialogOpen(false)} data-testid="button-cancel-kpi">
              Cancel
            </Button>
            <Button 
              onClick={() => createKpiMutation.mutate(kpiForm)}
              disabled={createKpiMutation.isPending || !kpiForm.name}
              data-testid="button-save-kpi"
            >
              {createKpiMutation.isPending ? "Adding..." : "Add KPI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
