import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgram } from "@/contexts/ProgramContext";
import { 
  Plus, 
  Trophy, 
  TrendingUp, 
  Target, 
  AlertCircle,
  PieChart,
  DollarSign,
  Calendar
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Benefit } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export function Benefits() {
  const { selectedProgramId } = useProgram();
  
  const { data: benefits, isLoading, error } = useQuery<Benefit[]>({
    queryKey: ['/api/benefits', selectedProgramId],
    queryFn: async () => {
      if (!selectedProgramId) return [];
      const res = await fetch(`/api/benefits?programId=${selectedProgramId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch benefits');
      return res.json();
    },
    enabled: !!selectedProgramId,
  });

  if (!selectedProgramId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please select a program from the dropdown above to view benefits information.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
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
          Failed to load benefits. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  const getBenefitsSummary = () => {
    if (!benefits) return { totalExpected: 0, totalRealized: 0, count: 0 };
    
    const totalExpected = benefits.reduce((sum, benefit) => 
      sum + parseFloat(benefit.targetValue || '0'), 0
    );
    const totalRealized = benefits.reduce((sum, benefit) => 
      sum + parseFloat(benefit.realizedValue || '0'), 0
    );
    
    return {
      totalExpected,
      totalRealized,
      count: benefits.length,
      realizationRate: totalExpected > 0 ? (totalRealized / totalExpected) * 100 : 0
    };
  };

  const getBenefitsByCategory = () => {
    if (!benefits) return {};
    
    return benefits.reduce((acc: { [key: string]: { expected: number; realized: number; count: number } }, benefit) => {
      const category = benefit.category || 'Other';
      if (!acc[category]) {
        acc[category] = { expected: 0, realized: 0, count: 0 };
      }
      acc[category].expected += parseFloat(benefit.targetValue || '0');
      acc[category].realized += parseFloat(benefit.realizedValue || '0');
      acc[category].count += 1;
      return acc;
    }, {});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Realized':
        return 'bg-green-100 text-green-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'At Risk':
        return 'bg-yellow-100 text-yellow-800';
      case 'Not Started':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const summary = getBenefitsSummary();
  const categorizedBenefits = getBenefitsByCategory();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div></div>
        <Button data-testid="button-add-benefit">
          <Plus className="h-4 w-4 mr-2" />
          Add Benefit
        </Button>
      </div>

      {/* Benefits Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Expected Value</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalExpected)}</p>
              <p className="text-xs text-muted-foreground mt-1">Across all benefits</p>
            </div>
            <Target className="h-8 w-8 text-blue-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Realized to Date</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalRealized)}</p>
              <div className="flex items-center space-x-2 mt-2">
                <Progress value={summary.realizationRate} className="w-16 h-2" />
                <span className="text-xs font-medium text-green-600">
                  {summary.realizationRate?.toFixed(0) || 0}%
                </span>
              </div>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">ROI Projection</p>
              <p className="text-2xl font-bold text-foreground">185%</p>
              <p className="text-xs text-muted-foreground mt-1">18-month payback</p>
            </div>
            <Trophy className="h-8 w-8 text-purple-600" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {!benefits || benefits.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No benefits defined</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Start tracking your program's value by defining expected benefits
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Benefit
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Benefits by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChart className="h-5 w-5" />
                    <span>Benefits by Category</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(categorizedBenefits).map(([category, data], index) => {
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
                    const bgColors = ['bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-orange-100', 'bg-pink-100'];
                    const textColors = ['text-blue-800', 'text-green-800', 'text-purple-800', 'text-orange-800', 'text-pink-800'];
                    
                    const progress = data.expected > 0 ? (data.realized / data.expected) * 100 : 0;
                    
                    return (
                      <div key={category} className="space-y-2" data-testid={`category-${category}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                            <span className="font-medium text-foreground">{category}</span>
                            <span className="text-sm text-muted-foreground">({data.count} benefits)</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">{formatCurrency(data.realized)}</p>
                            <p className="text-xs text-muted-foreground">of {formatCurrency(data.expected)}</p>
                          </div>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{progress.toFixed(0)}% realized</span>
                          <Badge className={`${bgColors[index % bgColors.length]} ${textColors[index % textColors.length]}`}>
                            {formatCurrency(data.expected - data.realized)} remaining
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Benefits Tracking Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Benefits Progress</span>
                  </CardTitle>
                  <CardDescription>Target vs Realized by Category</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(categorizedBenefits).length === 0 ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No benefits data available</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={Object.entries(categorizedBenefits).map(([category, data]) => ({
                          category,
                          target: data.expected,
                          realized: data.realized,
                        }))}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Legend />
                        <Bar dataKey="target" fill="hsl(217, 91%, 60%)" name="Target" data-testid="bar-target" />
                        <Bar dataKey="realized" fill="hsl(142, 71%, 45%)" name="Realized" data-testid="bar-realized" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(categorizedBenefits).map(([category, data], index) => {
              const colors = ['border-blue-200', 'border-green-200', 'border-purple-200', 'border-orange-200', 'border-pink-200'];
              const iconColors = ['text-blue-600', 'text-green-600', 'text-purple-600', 'text-orange-600', 'text-pink-600'];
              const bgColors = ['bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50', 'bg-pink-50'];
              
              const progress = data.expected > 0 ? (data.realized / data.expected) * 100 : 0;
              
              return (
                <Card key={category} className={colors[index % colors.length]} data-testid={`category-card-${category}`}>
                  <CardHeader className={`pb-2 ${bgColors[index % bgColors.length]}`}>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <DollarSign className={`h-5 w-5 ${iconColors[index % iconColors.length]}`} />
                        <span>{category}</span>
                      </div>
                      <Badge variant="outline">{data.count}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Expected</span>
                        <span className="font-medium">{formatCurrency(data.expected)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Realized</span>
                        <span className="font-medium text-green-600">{formatCurrency(data.realized)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Remaining</span>
                        <span className="font-medium">{formatCurrency(data.expected - data.realized)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Benefit Tracking</CardTitle>
              <CardDescription>Detailed tracking of all program benefits</CardDescription>
            </CardHeader>
            <CardContent>
              {!benefits || benefits.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No benefits to track</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold text-foreground">Benefit</th>
                        <th className="text-left p-4 font-semibold text-foreground">Category</th>
                        <th className="text-left p-4 font-semibold text-foreground">Target Value</th>
                        <th className="text-left p-4 font-semibold text-foreground">Realized Value</th>
                        <th className="text-left p-4 font-semibold text-foreground">Progress</th>
                        <th className="text-left p-4 font-semibold text-foreground">Status</th>
                        <th className="text-left p-4 font-semibold text-foreground">Owner</th>
                        <th className="text-left p-4 font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benefits.map((benefit) => {
                        const target = parseFloat(benefit.targetValue || '0');
                        const realized = parseFloat(benefit.realizedValue || '0');
                        const progress = target > 0 ? (realized / target) * 100 : 0;

                        return (
                          <tr key={benefit.id} className="border-b hover:bg-accent/50" data-testid={`benefit-row-${benefit.id}`}>
                            <td className="p-4">
                              <div>
                                <p className="font-medium text-foreground">{benefit.name}</p>
                                {benefit.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {benefit.description}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground">{benefit.category}</td>
                            <td className="p-4 font-medium text-foreground">
                              {formatCurrency(target)}
                            </td>
                            <td className="p-4 font-medium text-green-600">
                              {formatCurrency(realized)}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center space-x-2">
                                <Progress value={progress} className="w-16 h-2" />
                                <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge className={getStatusColor(benefit.status)}>
                                {benefit.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {benefit.ownerId || 'Unassigned'}
                            </td>
                            <td className="p-4">
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm" data-testid={`edit-benefit-${benefit.id}`}>
                                  Edit
                                </Button>
                                <Button variant="ghost" size="sm" data-testid={`view-benefit-${benefit.id}`}>
                                  <TrendingUp className="h-4 w-4" />
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
