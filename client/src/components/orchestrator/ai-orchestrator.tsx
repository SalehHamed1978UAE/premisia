import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  Code, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Sparkles,
  Plus,
  X,
  Loader2
} from "lucide-react";
import type { OrchestratorTask, OrchestratorResponse } from "@shared/schema";

export function AIOrchestrator() {
  const { toast } = useToast();
  const [taskDescription, setTaskDescription] = useState("");
  const [requirements, setRequirements] = useState<string[]>([""]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [entity, setEntity] = useState<string>("");
  const [provider, setProvider] = useState<string>("openai");
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);

  // Mutation for submitting task
  const submitTask = useMutation({
    mutationFn: async (task: Partial<OrchestratorTask>) => {
      const response = await apiRequest("POST", "/api/orchestrator/task", task);
      return await response.json() as OrchestratorResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Task Submitted",
        description: `AI orchestration ${data.verdict === "PASS" ? "succeeded" : "completed"} (${data.iterations} iteration${data.iterations !== 1 ? "s" : ""})`,
      });
      setLastTaskId(new Date().toISOString()); // Use timestamp as simple ID
      // Reset form
      setTaskDescription("");
      setRequirements([""]);
      setConstraints([]);
      setEntity("");
      setProvider("openai");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit task",
        variant: "destructive",
      });
    },
  });

  const addRequirement = () => {
    // Add a new empty requirement at the end
    setRequirements([...requirements, ""]);
  };

  const removeRequirement = (index: number) => {
    if (requirements.length > 1) {
      setRequirements(requirements.filter((_, i) => i !== index));
    }
  };

  const updateRequirement = (index: number, value: string) => {
    const newRequirements = [...requirements];
    newRequirements[index] = value;
    setRequirements(newRequirements);
  };

  const addConstraint = () => {
    // Add a new empty constraint at the end
    setConstraints([...constraints, ""]);
  };

  const removeConstraint = (index: number) => {
    setConstraints(constraints.filter((_, i) => i !== index));
  };

  const updateConstraint = (index: number, value: string) => {
    const newConstraints = [...constraints];
    newConstraints[index] = value;
    setConstraints(newConstraints);
  };

  const handleSubmit = () => {
    const filteredReqs = requirements.filter(r => r.trim());
    
    if (!taskDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Task description is required",
        variant: "destructive",
      });
      return;
    }

    if (filteredReqs.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one requirement is required",
        variant: "destructive",
      });
      return;
    }

    const task: Partial<OrchestratorTask> = {
      taskDescription: taskDescription.trim(),
      requirements: filteredReqs,
      constraints: constraints.length > 0 ? constraints : undefined,
      entity: entity.trim() && entity !== 'none' ? entity.trim() : undefined,
      preferredProvider: provider as any,
      maxRetries: 2,
    };

    submitTask.mutate(task);
  };

  const renderResult = () => {
    if (!submitTask.data) return null;

    const result = submitTask.data;

    return (
      <Card className="mt-6" data-testid="result-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {result.verdict === "PASS" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Orchestration Result: {result.verdict}
            </CardTitle>
            <Badge variant={result.verdict === "PASS" ? "default" : "destructive"} data-testid="badge-verdict">
              {result.provider} · {result.iterations} iteration{result.iterations !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>
            {new Date(result.timestamp).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Builder Response */}
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Code className="h-4 w-4" />
              Builder Output
            </h3>
            <div className="space-y-3">
              <div>
                <Label>Approach</Label>
                <p className="text-sm text-muted-foreground" data-testid="text-approach">
                  {result.builderResponse.approach}
                </p>
              </div>
              
              <div>
                <Label>Confidence: {result.builderResponse.confidence}%</Label>
                <div className="w-full bg-secondary rounded-full h-2 mt-1">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${result.builderResponse.confidence}%` }}
                  />
                </div>
              </div>

              {/* Code Artifacts */}
              <div>
                <Label>Generated Code ({result.builderResponse.artifacts.length} file{result.builderResponse.artifacts.length !== 1 ? "s" : ""})</Label>
                <ScrollArea className="h-[300px] border rounded-md mt-2">
                  {result.builderResponse.artifacts.map((artifact, idx) => (
                    <div key={idx} className="p-4 border-b last:border-b-0">
                      <div className="font-mono text-xs text-muted-foreground mb-2" data-testid={`text-filepath-${idx}`}>
                        {artifact.filePath}
                      </div>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto" data-testid={`text-code-${idx}`}>
                        {artifact.content}
                      </pre>
                      {artifact.description && (
                        <p className="text-xs text-muted-foreground mt-2">{artifact.description}</p>
                      )}
                    </div>
                  ))}
                </ScrollArea>
              </div>

              {/* Unmet Requirements */}
              {result.builderResponse.unmetRequirements.length > 0 && (
                <div>
                  <Label className="text-orange-600">Unmet Requirements</Label>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                    {result.builderResponse.unmetRequirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* QA Review */}
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              QA Review
            </h3>
            <div className="space-y-3">
              <div>
                <Label>Summary</Label>
                <p className="text-sm text-muted-foreground" data-testid="text-qa-summary">
                  {result.qaReview.summary}
                </p>
              </div>

              <div>
                <Label>Confidence: {result.qaReview.confidence}%</Label>
                <div className="w-full bg-secondary rounded-full h-2 mt-1">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${result.qaReview.confidence}%` }}
                  />
                </div>
              </div>

              {/* Requirements Verification */}
              <div>
                <Label>Requirements Verification</Label>
                <div className="space-y-2 mt-2">
                  {result.qaReview.requirementsVerification.map((req, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {req.satisfied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{req.requirement}</p>
                        <p className="text-muted-foreground text-xs">{req.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Issues */}
              {result.qaReview.issues.length > 0 && (
                <div>
                  <Label>Issues Found ({result.qaReview.issues.length})</Label>
                  <div className="space-y-2 mt-2">
                    {result.qaReview.issues.map((issue, idx) => (
                      <div key={idx} className="border-l-2 border-orange-500 pl-3 py-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={issue.severity === "critical" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {issue.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{issue.category}</span>
                        </div>
                        <p className="text-sm mt-1">{issue.description}</p>
                        {issue.recommendation && (
                          <p className="text-xs text-muted-foreground mt-1">→ {issue.recommendation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Critical Blockers */}
              {result.qaReview.criticalBlockers.length > 0 && (
                <div>
                  <Label className="text-red-600">Critical Blockers</Label>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                    {result.qaReview.criticalBlockers.map((blocker, idx) => (
                      <li key={idx}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-task-submission">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Task Orchestrator
          </CardTitle>
          <CardDescription>
            Submit development tasks to the multi-agent AI system. The Builder agent generates code, and the QA agent reviews it adversarially.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Task Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description">Task Description *</Label>
            <Textarea
              id="task-description"
              data-testid="input-task-description"
              placeholder="Describe what you want the AI to build..."
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Requirements */}
          <div className="space-y-2">
            <Label>Requirements *</Label>
            <div className="space-y-2">
              {requirements.map((req, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input 
                    placeholder="Enter a requirement..."
                    value={req} 
                    onChange={(e) => updateRequirement(idx, e.target.value)}
                    data-testid={`input-requirement-${idx}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRequirement(idx)}
                    disabled={requirements.length === 1}
                    data-testid={`button-remove-requirement-${idx}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button 
                onClick={addRequirement} 
                variant="outline" 
                size="sm" 
                className="w-full"
                data-testid="button-add-requirement"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Requirement
              </Button>
            </div>
          </div>

          {/* Constraints (Optional) */}
          <div className="space-y-2">
            <Label>Constraints (Optional)</Label>
            <div className="space-y-2">
              {constraints.map((constraint, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input 
                    placeholder="Enter a constraint..."
                    value={constraint} 
                    onChange={(e) => updateConstraint(idx, e.target.value)}
                    data-testid={`input-constraint-${idx}`} 
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeConstraint(idx)}
                    data-testid={`button-remove-constraint-${idx}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button 
                onClick={addConstraint} 
                variant="outline" 
                size="sm" 
                className="w-full"
                data-testid="button-add-constraint"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Constraint
              </Button>
            </div>
          </div>

          {/* Entity Context (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="entity">Entity Context (Optional)</Label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger id="entity" data-testid="select-entity">
                <SelectValue placeholder="Select entity for ontology context..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" data-testid="select-entity-none">None</SelectItem>
                <SelectItem value="program" data-testid="select-entity-program">Program</SelectItem>
                <SelectItem value="workstream" data-testid="select-entity-workstream">Workstream</SelectItem>
                <SelectItem value="task" data-testid="select-entity-task">Task</SelectItem>
                <SelectItem value="kpi" data-testid="select-entity-kpi">KPI</SelectItem>
                <SelectItem value="risk" data-testid="select-entity-risk">Risk</SelectItem>
                <SelectItem value="benefit" data-testid="select-entity-benefit">Benefit</SelectItem>
                <SelectItem value="resource" data-testid="select-entity-resource">Resource</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* AI Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">AI Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider" data-testid="select-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai" data-testid="select-provider-openai">OpenAI (GPT-5)</SelectItem>
                <SelectItem value="anthropic" data-testid="select-provider-anthropic">Anthropic (Claude Sonnet 4)</SelectItem>
                <SelectItem value="gemini" data-testid="select-provider-gemini">Google (Gemini 2.5 Pro)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitTask.isPending}
            className="w-full"
            data-testid="button-submit-task"
          >
            {submitTask.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Submit to AI Orchestrator
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {renderResult()}
    </div>
  );
}
