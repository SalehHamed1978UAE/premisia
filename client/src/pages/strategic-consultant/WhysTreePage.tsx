import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ChevronLeft, ChevronRight, ArrowRight, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";

interface WhyNode {
  id: string;
  question: string;
  option: string;
  depth: number;
  branches?: WhyNode[];
  isLeaf: boolean;
  parentId?: string;
}

interface WhyTree {
  rootQuestion: string;
  branches: WhyNode[];
  maxDepth: number;
  sessionId: string;
}

export default function WhysTreePage() {
  const [, params] = useRoute("/strategic-consultant/whys-tree/:sessionId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;

  const [tree, setTree] = useState<WhyTree | null>(null);
  const [selectedPath, setSelectedPath] = useState<{ nodeId: string; option: string; depth: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentOptionIndex, setCurrentOptionIndex] = useState(0);

  const generateTreeMutation = useMutation({
    mutationFn: async () => {
      const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';
      const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/generate', {
        sessionId,
        input,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setTree(data.tree);
    },
    onError: (error: any) => {
      toast({
        title: "Tree generation failed",
        description: error.message || "Failed to generate decision tree",
        variant: "destructive",
      });
    },
  });

  const expandBranchMutation = useMutation({
    mutationFn: async ({ nodeId, parentQuestion, currentDepth }: {
      nodeId: string;
      parentQuestion: string;
      currentDepth: number;
    }) => {
      const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';
      const pathOptions = selectedPath.map(p => p.option);
      const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/expand', {
        sessionId,
        nodeId,
        selectedPath: pathOptions,
        currentDepth,
        parentQuestion,
        input,
      });
      return response.json();
    },
    onSuccess: (data: any, variables) => {
      if (data.expandedBranches && tree) {
        const updateNodeBranches = (nodes: WhyNode[]): WhyNode[] => {
          return nodes.map(node => {
            if (node.id === variables.nodeId) {
              return { ...node, branches: data.expandedBranches };
            }
            if (node.branches) {
              return { ...node, branches: updateNodeBranches(node.branches) };
            }
            return node;
          });
        };

        setTree({
          ...tree,
          branches: updateNodeBranches(tree.branches),
        });
        setCurrentLevel(prev => prev + 1);
        setCurrentOptionIndex(0);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Expansion failed",
        description: error.message || "Failed to expand branch",
        variant: "destructive",
      });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async ({ rootCause, completePath }: { rootCause: string; completePath: string[] }) => {
      const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';
      const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/finalize', {
        sessionId,
        selectedPath: completePath,
        rootCause,
        input,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Root cause identified",
        description: "Proceeding to research phase",
      });
      setLocation(`/strategic-consultant/research/${sessionId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Finalization failed",
        description: error.message || "Failed to finalize root cause",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (sessionId) {
      generateTreeMutation.mutate();
    }
  }, [sessionId]);

  const getCurrentOptions = (): WhyNode[] => {
    if (!tree) return [];

    if (currentLevel === 1) {
      return tree.branches;
    }

    let currentNodes = tree.branches;
    for (let i = 0; i < selectedPath.length; i++) {
      const selectedNode = currentNodes.find(n => n.id === selectedPath[i].nodeId);
      if (!selectedNode || !selectedNode.branches) return [];
      currentNodes = selectedNode.branches;
    }

    return currentNodes;
  };

  const currentOptions = getCurrentOptions();
  const currentOption = currentOptions[currentOptionIndex];
  const totalOptions = currentOptions.length;

  const handlePrevious = () => {
    setCurrentOptionIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentOptionIndex(prev => Math.min(totalOptions - 1, prev + 1));
  };

  const handleSelectAndContinue = () => {
    if (!currentOption) return;

    const newPath = [...selectedPath, {
      nodeId: currentOption.id,
      option: currentOption.option,
      depth: currentOption.depth
    }];
    setSelectedPath(newPath);

    if (currentOption.branches && currentOption.branches.length > 0) {
      setCurrentLevel(prev => prev + 1);
      setCurrentOptionIndex(0);
    } else {
      expandBranchMutation.mutate({
        nodeId: currentOption.id,
        parentQuestion: currentOption.question,
        currentDepth: currentOption.depth,
      });
    }
  };

  const handleFinalize = () => {
    if (!currentOption) return;
    
    const finalPath = [...selectedPath, {
      nodeId: currentOption.id,
      option: currentOption.option,
      depth: currentOption.depth
    }];
    
    const pathOptions = finalPath.map(p => p.option);
    finalizeMutation.mutate({
      rootCause: currentOption.option,
      completePath: pathOptions
    });
  };

  const canShowRootCauseButton = currentLevel >= 3;
  const canShowContinueButton = currentLevel < 5;
  const showOnlyFinalize = currentLevel === 5;

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>No session ID provided</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (generateTreeMutation.isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Generating Five Whys analysis...</p>
          <p className="text-sm text-muted-foreground">This may take 20-30 seconds</p>
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>Failed to load decision tree</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <AppLayout
      title="Five Whys Analysis"
      subtitle="Discover root causes through strategic questioning"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-sm px-3 py-1" data-testid="level-indicator">
            Level {currentLevel} of 5
          </Badge>
          <p className="text-sm text-muted-foreground" data-testid="root-question">
            {tree.rootQuestion}
          </p>
        </div>

        {/* Breadcrumb Trail */}
        {selectedPath.length > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Your path so far:</p>
              <div className="flex flex-wrap gap-2" data-testid="breadcrumb-path">
                {selectedPath.map((pathItem, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      L{pathItem.depth}: {pathItem.option}
                    </Badge>
                    {idx < selectedPath.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Option Card (Carousel) */}
        {expandBranchMutation.isPending ? (
          <Card className="border-2">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div>
                  <p className="text-lg font-semibold">Generating next level of Whys...</p>
                  <p className="text-sm text-muted-foreground mt-1">This usually takes 10-15 seconds</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : currentOption ? (
          <Card className="border-2" data-testid={`option-card-${currentOption.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-2xl font-bold">
                  {currentOption.option}
                </CardTitle>
                <Badge variant="default">
                  Option {currentOptionIndex + 1} of {totalOptions}
                </Badge>
              </div>
              {currentOption.question && (
                <p className="text-muted-foreground italic mt-2">
                  Next question: {currentOption.question}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Navigation Buttons */}
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentOptionIndex === 0}
                  data-testid="button-previous"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <span className="text-sm text-muted-foreground">
                  {currentOptionIndex + 1} / {totalOptions}
                </span>

                <Button
                  variant="outline"
                  onClick={handleNext}
                  disabled={currentOptionIndex === totalOptions - 1}
                  data-testid="button-next"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t space-y-3">
                {!showOnlyFinalize && canShowContinueButton && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSelectAndContinue}
                    disabled={finalizeMutation.isPending}
                    data-testid="button-continue"
                  >
                    <ArrowRight className="h-5 w-5 mr-2" />
                    Continue to next Why
                  </Button>
                )}

                {canShowRootCauseButton && (
                  <Button
                    variant={showOnlyFinalize ? "default" : "secondary"}
                    className="w-full"
                    size="lg"
                    onClick={handleFinalize}
                    disabled={finalizeMutation.isPending}
                    data-testid="button-finalize"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    {finalizeMutation.isPending ? "Processing..." : "This is my root cause"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <AlertDescription>No options available at this level</AlertDescription>
          </Alert>
        )}

        {/* Mini Thumbnails (Optional visual aid) */}
        {totalOptions > 1 && (
          <div className="flex gap-2 justify-center flex-wrap">
            {currentOptions.map((option, idx) => (
              <button
                key={option.id}
                onClick={() => setCurrentOptionIndex(idx)}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  idx === currentOptionIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
                data-testid={`thumbnail-${idx}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
