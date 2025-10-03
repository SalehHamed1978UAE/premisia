import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Users, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { Program } from "@shared/schema";

export default function ProgramsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "Active"
  });

  const { data: programs, isLoading } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  const createProgramMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/programs', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs'] });
      setDialogOpen(false);
      setFormData({ name: "", description: "", startDate: "", endDate: "", status: "Active" });
      toast({ title: "Program created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create program", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Program name is required", variant: "destructive" });
      return;
    }
    createProgramMutation.mutate({
      ...formData,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" data-testid="button-back-home">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Programs Management</h1>
            </div>
            <p className="text-muted-foreground" data-testid="text-page-subtitle">
              Manage all enterprise programs in one place
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-program">
                <Plus className="mr-2 h-4 w-4" />
                Create Program
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-program">
              <DialogHeader>
                <DialogTitle>Create New Program</DialogTitle>
                <DialogDescription>
                  Add a new program to your portfolio. Stage gates will be created automatically.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Program Name *
                  </label>
                  <Input
                    id="name"
                    data-testid="input-program-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter program name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description
                  </label>
                  <Textarea
                    id="description"
                    data-testid="input-program-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter program description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="startDate" className="text-sm font-medium">
                      Start Date
                    </label>
                    <Input
                      id="startDate"
                      type="date"
                      data-testid="input-program-start-date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="endDate" className="text-sm font-medium">
                      End Date
                    </label>
                    <Input
                      id="endDate"
                      type="date"
                      data-testid="input-program-end-date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    data-testid="button-cancel-program"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createProgramMutation.isPending}
                    data-testid="button-submit-program"
                  >
                    {createProgramMutation.isPending ? "Creating..." : "Create Program"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {programs && programs.length === 0 ? (
          <Alert data-testid="alert-no-programs">
            <AlertDescription>
              No programs found. Create your first program to get started.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs?.map((program) => (
              <Card key={program.id} className="hover:shadow-lg transition-shadow" data-testid={`card-program-${program.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between" data-testid={`text-program-name-${program.id}`}>
                    {program.name}
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      program.status === 'Active' ? 'bg-green-100 text-green-800' :
                      program.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`} data-testid={`text-program-status-${program.id}`}>
                      {program.status}
                    </span>
                  </CardTitle>
                  <CardDescription data-testid={`text-program-description-${program.id}`}>
                    {program.description || "No description provided"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {program.startDate && (
                      <div className="flex items-center gap-2" data-testid={`text-program-dates-${program.id}`}>
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(program.startDate).toLocaleDateString()}
                          {program.endDate && ` - ${new Date(program.endDate).toLocaleDateString()}`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
