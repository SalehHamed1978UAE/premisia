import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Plus, X, Check } from "lucide-react";
import type { SessionContext } from "@shared/schema";

export function SessionContextPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [newCriteria, setNewCriteria] = useState("");
  const [criteriaList, setCriteriaList] = useState<string[]>([]);

  const { data: activeContext } = useQuery<SessionContext | null>({
    queryKey: ["/api/session-context"],
  });

  const createContextMutation = useMutation({
    mutationFn: async (data: { goal: string; successCriteria: string[] }) => {
      return await apiRequest("POST", "/api/session-context", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session-context"] });
      setIsCreating(false);
      setNewGoal("");
      setCriteriaList([]);
    },
  });

  const updateContextMutation = useMutation({
    mutationFn: async ({ id, successCriteria }: { id: string; successCriteria: string[] }) => {
      return await apiRequest("PATCH", `/api/session-context/${id}`, { successCriteria });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session-context"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/session-context/${id}/deactivate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session-context"] });
    },
  });

  const handleAddCriteria = () => {
    if (newCriteria.trim()) {
      setCriteriaList([...criteriaList, newCriteria.trim()]);
      setNewCriteria("");
    }
  };

  const handleCreateSession = () => {
    if (newGoal.trim() && criteriaList.length > 0) {
      createContextMutation.mutate({
        goal: newGoal.trim(),
        successCriteria: criteriaList,
      });
    }
  };

  const handleToggleCriteria = (index: number) => {
    if (!activeContext) return;
    
    const updatedCriteria = [...activeContext.successCriteria];
    const criterion = updatedCriteria[index];
    
    // Toggle ✓ prefix
    if (criterion.startsWith("✓ ")) {
      updatedCriteria[index] = criterion.substring(2);
    } else {
      updatedCriteria[index] = `✓ ${criterion}`;
    }

    updateContextMutation.mutate({
      id: activeContext.id,
      successCriteria: updatedCriteria,
    });
  };

  const completedCount = activeContext?.successCriteria.filter((c) => c.startsWith("✓ ")).length || 0;
  const totalCount = activeContext?.successCriteria.length || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed right-4 top-20 z-50 bg-surface border border-border shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-toggle-session-context"
      >
        {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {/* Session Context Panel */}
      <div
        className={`fixed right-0 top-16 h-[calc(100vh-4rem)] w-80 bg-surface border-l border-border transition-transform duration-200 ease-in-out z-40 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold" data-testid="text-session-context-title">Session Context</h2>
              {activeContext && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deactivateMutation.mutate(activeContext.id)}
                  data-testid="button-end-session"
                >
                  End Session
                </Button>
              )}
            </div>
            {activeContext && (
              <>
                <div className="text-sm text-muted-foreground" data-testid="text-session-progress">
                  {completedCount} of {totalCount} criteria met ({progress}%)
                </div>
                {completedCount < totalCount && (
                  <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded text-sm text-warning flex items-center gap-2" data-testid="warning-incomplete-criteria">
                    <span className="font-medium">⚠️ Warning:</span>
                    <span>{totalCount - completedCount} criteria still unmet</span>
                  </div>
                )}
                {completedCount === totalCount && totalCount > 0 && (
                  <div className="mt-2 p-2 bg-success/10 border border-success/20 rounded text-sm text-success flex items-center gap-2" data-testid="success-all-criteria-met">
                    <Check className="h-4 w-4" />
                    <span className="font-medium">All criteria met!</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-4">
            {!activeContext && !isCreating && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">No active session</p>
                <Button onClick={() => setIsCreating(true)} data-testid="button-start-new-session">
                  Start New Session
                </Button>
              </div>
            )}

            {isCreating && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Goal</label>
                  <Input
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder="What are we trying to accomplish?"
                    data-testid="input-session-goal"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Success Criteria</label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newCriteria}
                      onChange={(e) => setNewCriteria(e.target.value)}
                      placeholder="Add success criterion"
                      onKeyPress={(e) => e.key === "Enter" && handleAddCriteria()}
                      data-testid="input-new-criteria"
                    />
                    <Button onClick={handleAddCriteria} size="icon" data-testid="button-add-criteria">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {criteriaList.length > 0 && (
                    <ul className="space-y-1">
                      {criteriaList.map((criteria, idx) => (
                        <li
                          key={idx}
                          className="text-sm flex items-center justify-between bg-muted p-2 rounded"
                          data-testid={`criteria-item-${idx}`}
                        >
                          <span>{criteria}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCriteriaList(criteriaList.filter((_, i) => i !== idx))}
                            data-testid={`button-remove-criteria-${idx}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateSession}
                    disabled={!newGoal.trim() || criteriaList.length === 0}
                    className="flex-1"
                    data-testid="button-create-session"
                  >
                    Create Session
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false);
                      setNewGoal("");
                      setCriteriaList([]);
                    }}
                    data-testid="button-cancel-session"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {activeContext && !isCreating && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Current Goal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm" data-testid="text-current-goal">{activeContext.goal}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Success Criteria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {activeContext.successCriteria.map((criteria, idx) => {
                        const isChecked = criteria.startsWith("✓ ");
                        const displayText = isChecked ? criteria.substring(2) : criteria;
                        
                        return (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm"
                            data-testid={`success-criteria-${idx}`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleToggleCriteria(idx)}
                              data-testid={`checkbox-criteria-${idx}`}
                            />
                            <span className={isChecked ? "line-through text-muted-foreground" : ""}>
                              {displayText}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>

                {activeContext.currentPhase && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Current Phase</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm" data-testid="text-current-phase">{activeContext.currentPhase}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </>
  );
}
