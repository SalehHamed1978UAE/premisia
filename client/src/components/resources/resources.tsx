import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Plus, 
  Users, 
  User, 
  AlertCircle,
  Mail,
  Building,
  Clock,
  Activity
} from "lucide-react";
import type { Resource, Task } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export function Resources() {
  const { data: resources, isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: ['/api/resources'],
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
  });

  const isLoading = resourcesLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-10 w-10 rounded-full mb-4" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getResourceUtilization = (resourceId: string) => {
    if (!tasks) return { activeTasks: 0, completedTasks: 0, utilization: 0 };
    
    const resourceTasks = tasks.filter(task => task.ownerId === resourceId);
    const activeTasks = resourceTasks.filter(task => 
      task.status === 'In Progress' || task.status === 'At Risk'
    ).length;
    const completedTasks = resourceTasks.filter(task => 
      task.status === 'Completed'
    ).length;
    
    // Simple utilization calculation based on active tasks
    // In real implementation, this would be more sophisticated
    const utilization = Math.min(activeTasks * 20, 100); // 20% per active task, max 100%
    
    return {
      activeTasks,
      completedTasks,
      totalTasks: resourceTasks.length,
      utilization
    };
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'text-red-600';
    if (utilization >= 70) return 'text-orange-600';
    if (utilization >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUtilizationStatus = (utilization: number) => {
    if (utilization >= 90) return { label: 'Overloaded', className: 'bg-red-100 text-red-800' };
    if (utilization >= 70) return { label: 'High Load', className: 'bg-orange-100 text-orange-800' };
    if (utilization >= 50) return { label: 'Optimal', className: 'bg-green-100 text-green-800' };
    return { label: 'Available', className: 'bg-blue-100 text-blue-800' };
  };

  const getDepartmentSummary = () => {
    if (!resources) return {};
    
    return resources.reduce((acc: { [key: string]: number }, resource) => {
      const dept = resource.department || 'Other';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const departmentSummary = getDepartmentSummary();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div></div>
        <Button data-testid="button-add-resource">
          <Plus className="h-4 w-4 mr-2" />
          Add Resource
        </Button>
      </div>

      {/* Resource Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Resources</p>
              <p className="text-2xl font-bold text-foreground">{resources?.length || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Departments</p>
              <p className="text-2xl font-bold text-foreground">{Object.keys(departmentSummary).length}</p>
            </div>
            <Building className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">High Utilization</p>
              <p className="text-2xl font-bold text-foreground">
                {resources?.filter(r => getResourceUtilization(r.id).utilization >= 70).length || 0}
              </p>
            </div>
            <Activity className="h-8 w-8 text-orange-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Available</p>
              <p className="text-2xl font-bold text-foreground">
                {resources?.filter(r => getResourceUtilization(r.id).utilization < 50).length || 0}
              </p>
            </div>
            <User className="h-8 w-8 text-purple-600" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="team" className="space-y-6">
        <TabsList>
          <TabsTrigger value="team">Team View</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-6">
          {!resources || resources.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No team members</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add team members to start managing resources and assignments
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Team Member
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((resource) => {
                const utilization = getResourceUtilization(resource.id);
                const status = getUtilizationStatus(utilization.utilization);

                return (
                  <Card key={resource.id} className="hover:shadow-md transition-shadow" data-testid={`resource-card-${resource.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(resource.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold text-foreground">{resource.name}</h4>
                            <p className="text-sm text-muted-foreground">{resource.role}</p>
                          </div>
                        </div>
                        <Badge className={status.className}>
                          {status.label}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 text-sm">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {resource.department || 'Not specified'}
                          </span>
                        </div>

                        {resource.email && (
                          <div className="flex items-center space-x-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground truncate">
                              {resource.email}
                            </span>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Utilization</span>
                            <span className={`text-sm font-medium ${getUtilizationColor(utilization.utilization)}`}>
                              {utilization.utilization}%
                            </span>
                          </div>
                          <Progress value={utilization.utilization} className="h-2" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-center text-sm">
                          <div>
                            <p className="font-medium text-foreground">{utilization.activeTasks}</p>
                            <p className="text-muted-foreground">Active Tasks</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{utilization.completedTasks}</p>
                            <p className="text-muted-foreground">Completed</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border flex space-x-2">
                        <Button variant="outline" size="sm" className="flex-1" data-testid={`view-resource-${resource.id}`}>
                          View Tasks
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" data-testid={`edit-resource-${resource.id}`}>
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Department Breakdown</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(departmentSummary).length === 0 ? (
                <div className="text-center py-8">
                  <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No department information available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(departmentSummary).map(([department, count], index) => {
                    const colors = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800', 'bg-pink-100 text-pink-800'];
                    const iconColors = ['text-blue-600', 'text-green-600', 'text-purple-600', 'text-orange-600', 'text-pink-600'];
                    
                    return (
                      <Card key={department} className="text-center" data-testid={`department-${department}`}>
                        <CardContent className="p-6">
                          <Building className={`h-8 w-8 mx-auto mb-3 ${iconColors[index % iconColors.length]}`} />
                          <h3 className="font-semibold text-foreground mb-1">{department}</h3>
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-2xl font-bold text-foreground">{count}</span>
                            <Badge className={colors[index % colors.length]}>
                              {count === 1 ? 'member' : 'members'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="utilization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Resource Utilization</span>
              </CardTitle>
              <CardDescription>Team workload and capacity planning</CardDescription>
            </CardHeader>
            <CardContent>
              {!resources || resources.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No utilization data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {resources
                    .map(resource => ({
                      ...resource,
                      utilization: getResourceUtilization(resource.id)
                    }))
                    .sort((a, b) => b.utilization.utilization - a.utilization.utilization)
                    .map((resource) => {
                      const status = getUtilizationStatus(resource.utilization.utilization);

                      return (
                        <div key={resource.id} className="flex items-center justify-between p-4 border border-border rounded-lg" data-testid={`utilization-${resource.id}`}>
                          <div className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarFallback>
                                {getInitials(resource.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-medium text-foreground">{resource.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {resource.role} • {resource.department}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right text-sm">
                              <p className="font-medium text-foreground">
                                {resource.utilization.activeTasks} active tasks
                              </p>
                              <p className="text-muted-foreground">
                                {resource.utilization.completedTasks} completed
                              </p>
                            </div>
                            
                            <div className="w-24">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-medium ${getUtilizationColor(resource.utilization.utilization)}`}>
                                  {resource.utilization.utilization}%
                                </span>
                              </div>
                              <Progress value={resource.utilization.utilization} className="h-2" />
                            </div>

                            <Badge className={status.className}>
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
