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
  DollarSign, 
  TrendingDown, 
  Wallet, 
  AlertCircle,
  PieChart,
  Receipt,
  Calendar,
  FileText
} from "lucide-react";
import type { FundingSource, Expense } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export function Funding() {
  const { data: fundingSources, isLoading: sourcesLoading } = useQuery<FundingSource[]>({
    queryKey: ['/api/funding/sources'],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ['/api/funding/expenses'],
  });

  const isLoading = sourcesLoading || expensesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
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

  const getBudgetSummary = () => {
    const totalAllocated = fundingSources?.reduce((sum, source) => 
      sum + parseFloat(source.allocatedAmount || '0'), 0
    ) || 0;
    
    const totalSpent = expenses?.reduce((sum, expense) => 
      sum + parseFloat(expense.amount || '0'), 0
    ) || 0;
    
    const remaining = totalAllocated - totalSpent;
    const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    
    // Calculate burn rate (last 3 months average)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const recentExpenses = expenses?.filter(expense => 
      new Date(expense.expenseDate) >= threeMonthsAgo
    ) || [];
    
    const recentTotal = recentExpenses.reduce((sum, expense) => 
      sum + parseFloat(expense.amount || '0'), 0
    );
    const burnRate = recentTotal / 3; // Monthly average
    
    return {
      totalAllocated,
      totalSpent,
      remaining,
      utilizationRate,
      burnRate
    };
  };

  const getExpensesByCategory = () => {
    if (!expenses) return {};
    
    return expenses.reduce((acc: { [key: string]: number }, expense) => {
      const category = expense.category || 'Other';
      acc[category] = (acc[category] || 0) + parseFloat(expense.amount || '0');
      return acc;
    }, {});
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  const summary = getBudgetSummary();
  const expensesByCategory = getExpensesByCategory();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div></div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" data-testid="button-export-report">
            <FileText className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button data-testid="button-add-expense">
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Budget Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalAllocated)}</p>
              <p className="text-xs text-muted-foreground mt-1">Allocated for program</p>
            </div>
            <Wallet className="h-8 w-8 text-blue-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalSpent)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.utilizationRate.toFixed(1)}% utilized
              </p>
            </div>
            <Receipt className="h-8 w-8 text-orange-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Remaining</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.remaining)}</p>
              <p className="text-xs text-muted-foreground mt-1">Available to spend</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Burn Rate</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.burnRate)}</p>
              <p className="text-xs text-muted-foreground mt-1">Monthly average</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </CardContent>
        </Card>
      </div>

      {/* Budget Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Utilization</CardTitle>
          <CardDescription>Overall program budget status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Budget Progress</span>
              <span className="text-sm font-bold text-foreground">
                {summary.utilizationRate.toFixed(1)}%
              </span>
            </div>
            <Progress value={summary.utilizationRate} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Spent: {formatCurrency(summary.totalSpent)}
              </span>
              <span className="text-muted-foreground">
                Remaining: {formatCurrency(summary.remaining)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sources" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sources">Funding Sources</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wallet className="h-5 w-5" />
                <span>Funding Sources</span>
              </CardTitle>
              <CardDescription>Sources of program funding</CardDescription>
            </CardHeader>
            <CardContent>
              {!fundingSources || fundingSources.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No funding sources</h3>
                  <p className="text-muted-foreground mb-4">
                    Add funding sources to track your program budget
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Funding Source
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {fundingSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-4 border border-border rounded-lg" data-testid={`funding-source-${source.id}`}>
                      <div>
                        <h4 className="font-medium text-foreground">{source.sourceName}</h4>
                        <p className="text-sm text-muted-foreground">
                          Received: {formatDate(source.dateReceived)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          {formatCurrency(parseFloat(source.allocatedAmount || '0'))}
                        </p>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Receipt className="h-5 w-5" />
                <span>Recent Expenses</span>
              </CardTitle>
              <CardDescription>Program expenditure history</CardDescription>
            </CardHeader>
            <CardContent>
              {!expenses || expenses.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No expenses recorded</h3>
                  <p className="text-muted-foreground mb-4">
                    Start tracking program expenses to monitor budget utilization
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Expense
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold text-foreground">Date</th>
                        <th className="text-left p-4 font-semibold text-foreground">Description</th>
                        <th className="text-left p-4 font-semibold text-foreground">Category</th>
                        <th className="text-left p-4 font-semibold text-foreground">Vendor</th>
                        <th className="text-left p-4 font-semibold text-foreground">Amount</th>
                        <th className="text-left p-4 font-semibold text-foreground">Approved By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses
                        .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
                        .slice(0, 10)
                        .map((expense) => (
                          <tr key={expense.id} className="border-b hover:bg-accent/50" data-testid={`expense-row-${expense.id}`}>
                            <td className="p-4 text-sm text-muted-foreground">
                              {formatDate(expense.expenseDate)}
                            </td>
                            <td className="p-4">
                              <p className="font-medium text-foreground">{expense.description}</p>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline">{expense.category}</Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {expense.vendor || 'N/A'}
                            </td>
                            <td className="p-4 font-medium text-foreground">
                              {formatCurrency(parseFloat(expense.amount || '0'))}
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {expense.approvedById || 'N/A'}
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

        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="h-5 w-5" />
                <span>Expenses by Category</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(expensesByCategory).length === 0 ? (
                <div className="text-center py-8">
                  <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No expense categories to display</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(expensesByCategory)
                    .sort(([,a], [,b]) => b - a)
                    .map(([category, amount], index) => {
                      const percentage = summary.totalSpent > 0 ? (amount / summary.totalSpent) * 100 : 0;
                      const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
                      
                      return (
                        <div key={category} className="space-y-2" data-testid={`category-${category}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                              <span className="font-medium text-foreground">{category}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-foreground">{formatCurrency(amount)}</p>
                              <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Spending Trends</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                <div className="text-center">
                  <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Budget Trends</h3>
                  <p className="text-muted-foreground mb-4">
                    Spending patterns and budget forecasting
                  </p>
                  <Badge variant="outline">Chart Integration Required</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
