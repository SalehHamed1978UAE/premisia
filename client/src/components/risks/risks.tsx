import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  AlertTriangle, 
  AlertCircle,
  Filter,
  Grid3x3,
  List,
  Shield
} from "lucide-react";
import type { Risk, RiskMitigation } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export function Risks() {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null);

  const { data: risks, isLoading, error } = useQuery<Risk[]>({
    queryKey: ['/api/risks'],
  });

  const { data: mitigations } = useQuery<RiskMitigation[]>({
    queryKey: ['/api/risks', selectedRisk, 'mitigations'],
    enabled: !!selectedRisk,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-8 w-16" />
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
          Failed to load risks. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  const filteredRisks = risks?.filter(risk => {
    const priorityMatch = filterPriority === 'all' || risk.priority === filterPriority;
    const statusMatch = filterStatus === 'all' || risk.status === filterStatus;
    return priorityMatch && statusMatch;
  }) || [];

  const getRiskCounts = () => {
    if (!risks) return { total: 0, high: 0, medium: 0, low: 0, critical: 0 };
    
    return {
      total: risks.length,
      critical: risks.filter(r => r.priority === 'Critical').length,
      high: risks.filter(r => r.priority === 'High').length,
      medium: risks.filter(r => r.priority === 'Medium').length,
      low: risks.filter(r => r.priority === 'Low').length,
    };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-red-100 text-red-800';
      case 'Mitigated':
        return 'bg-blue-100 text-blue-800';
      case 'Closed':
        return 'bg-green-100 text-green-800';
      case 'Monitoring':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const riskCounts = getRiskCounts();

  // Risk matrix data
  const getRiskMatrixData = () => {
    const matrix: { [key: string]: number } = {};
    
    risks?.forEach(risk => {
      const key = `${risk.likelihood}-${risk.impact}`;
      matrix[key] = (matrix[key] || 0) + 1;
    });
    
    return matrix;
  };

  const matrixData = getRiskMatrixData();
  const impactLevels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
  const likelihoodLevels = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32" data-testid="filter-priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Mitigated">Mitigated</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
                <SelectItem value="Monitoring">Monitoring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button data-testid="button-add-risk">
          <Plus className="h-4 w-4 mr-2" />
          Add Risk
        </Button>
      </div>

      {/* Risk Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Risks</p>
              <p className="text-2xl font-bold text-foreground">{riskCounts.total}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-600">{riskCounts.critical}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">High</p>
              <p className="text-2xl font-bold text-orange-600">{riskCounts.high}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Medium</p>
              <p className="text-2xl font-bold text-yellow-600">{riskCounts.medium}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Low</p>
              <p className="text-2xl font-bold text-green-600">{riskCounts.low}</p>
            </div>
            <Shield className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="matrix" className="space-y-6">
        <TabsList>
          <TabsTrigger value="matrix" className="flex items-center space-x-2">
            <Grid3x3 className="h-4 w-4" />
            <span>Risk Matrix</span>
          </TabsTrigger>
          <TabsTrigger value="register" className="flex items-center space-x-2">
            <List className="h-4 w-4" />
            <span>Risk Register</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          {/* Risk Assessment Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Grid3x3 className="h-5 w-5" />
                <span>Risk Assessment Matrix</span>
              </CardTitle>
              <CardDescription>Likelihood vs Impact visualization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Matrix Header */}
                <div className="flex items-center justify-center">
                  <div className="grid grid-cols-6 gap-1 w-full max-w-2xl">
                    <div></div>
                    {impactLevels.map((level) => (
                      <div key={level} className="text-center text-xs font-medium text-muted-foreground p-2">
                        {level}
                      </div>
                    ))}
                    
                    {likelihoodLevels.reverse().map((likelihood) => (
                      <>
                        <div key={likelihood} className="flex items-center justify-end text-xs font-medium text-muted-foreground pr-2">
                          {likelihood}
                        </div>
                        {impactLevels.map((impact) => {
                          const count = matrixData[`${likelihood}-${impact}`] || 0;
                          const getCellColor = () => {
                            if (likelihood === 'Certain' && ['High', 'Very High'].includes(impact)) return 'bg-red-200 border-red-400';
                            if (likelihood === 'Likely' && impact === 'Very High') return 'bg-red-200 border-red-400';
                            if ((likelihood === 'Certain' && impact === 'Medium') || 
                                (likelihood === 'Likely' && impact === 'High') ||
                                (likelihood === 'Possible' && impact === 'Very High')) return 'bg-orange-200 border-orange-400';
                            if ((likelihood === 'Possible' && ['Medium', 'High'].includes(impact)) ||
                                (likelihood === 'Unlikely' && impact === 'Very High') ||
                                (likelihood === 'Likely' && impact === 'Medium')) return 'bg-yellow-200 border-yellow-400';
                            return 'bg-green-100 border-green-300';
                          };

                          return (
                            <div
                              key={`${likelihood}-${impact}`}
                              className={`aspect-square border-2 rounded flex items-center justify-center text-sm font-bold cursor-pointer hover:opacity-80 ${getCellColor()}`}
                              data-testid={`matrix-cell-${likelihood}-${impact}`}
                            >
                              {count > 0 ? count : ''}
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">Impact →</p>
                  <p className="text-sm font-medium text-muted-foreground">↑ Likelihood</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          {/* Risk Register */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Register</CardTitle>
              <CardDescription>Detailed list of all program risks</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredRisks.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {risks?.length === 0 ? 'No risks identified' : 'No risks match your filters'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {risks?.length === 0 
                      ? 'Start by identifying potential risks to your program'
                      : 'Try adjusting your filters to see more results'
                    }
                  </p>
                  {risks?.length === 0 && (
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Risk
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold text-foreground">ID</th>
                        <th className="text-left p-4 font-semibold text-foreground">Description</th>
                        <th className="text-left p-4 font-semibold text-foreground">Category</th>
                        <th className="text-left p-4 font-semibold text-foreground">Likelihood</th>
                        <th className="text-left p-4 font-semibold text-foreground">Impact</th>
                        <th className="text-left p-4 font-semibold text-foreground">Priority</th>
                        <th className="text-left p-4 font-semibold text-foreground">Owner</th>
                        <th className="text-left p-4 font-semibold text-foreground">Status</th>
                        <th className="text-left p-4 font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRisks.map((risk) => (
                        <tr key={risk.id} className="border-b hover:bg-accent/50" data-testid={`risk-row-${risk.id}`}>
                          <td className="p-4 font-mono text-sm font-medium text-foreground">
                            {risk.riskId}
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-foreground line-clamp-2">{risk.description}</p>
                              {risk.mitigationPlan && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                  Mitigation: {risk.mitigationPlan}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">{risk.category}</td>
                          <td className="p-4">
                            <Badge variant="outline">{risk.likelihood}</Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{risk.impact}</Badge>
                          </td>
                          <td className="p-4">
                            <Badge className={getPriorityColor(risk.priority)}>
                              {risk.priority}
                            </Badge>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {risk.ownerId || 'Unassigned'}
                          </td>
                          <td className="p-4">
                            <Badge className={getStatusColor(risk.status)}>
                              {risk.status}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex space-x-2">
                              <Button variant="ghost" size="sm" data-testid={`view-risk-${risk.id}`}>
                                View
                              </Button>
                              <Button variant="ghost" size="sm" data-testid={`edit-risk-${risk.id}`}>
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Active Mitigation Plans */}
      {risks && risks.some(r => r.status === 'Open' && r.mitigationPlan) && (
        <Card>
          <CardHeader>
            <CardTitle>Active Mitigation Plans</CardTitle>
            <CardDescription>Current risk mitigation activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {risks
                .filter(r => r.status === 'Open' && r.mitigationPlan)
                .map((risk) => (
                  <div key={risk.id} className="border border-border rounded-lg p-4" data-testid={`mitigation-${risk.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-foreground">
                          {risk.riskId}: {risk.description}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {risk.mitigationPlan}
                        </p>
                      </div>
                      <Badge className={getPriorityColor(risk.priority)}>
                        {risk.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Owner: {risk.ownerId || 'Unassigned'}</span>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
