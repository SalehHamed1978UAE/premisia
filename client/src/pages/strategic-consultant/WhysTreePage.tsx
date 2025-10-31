import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ChevronLeft, ChevronRight, ArrowRight, CheckCircle2, Edit, Plus, ChevronDown, Lightbulb } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { CoachingModal } from "@/components/five-whys/CoachingModal";

interface WhyNode {
  id: string;
  question: string;
  option: string;
  depth: number;
  branches?: WhyNode[];
  isLeaf: boolean;
  parentId?: string;
  isCustom?: boolean;
  supporting_evidence: string[];
  counter_arguments: string[];
  consideration: string;
}

interface WhyTree {
  rootQuestion: string;
  branches: WhyNode[];
  maxDepth: number;
  sessionId: string;
}

export default function WhysTreePage() {
  const [, params] = useRoute("/strategic-consultant/whys-tree/:understandingId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const understandingId = params?.understandingId;

  const [understanding, setUnderstanding] = useState<{ id: string; sessionId: string; userInput: string; journeyType?: string } | null>(null);
  const [isLoadingUnderstanding, setIsLoadingUnderstanding] = useState(true);
  const [tree, setTree] = useState<WhyTree | null>(null);
  const [selectedPath, setSelectedPath] = useState<{ nodeId: string; option: string; depth: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentOptionIndex, setCurrentOptionIndex] = useState(0);
  const [customWhyText, setCustomWhyText] = useState("");
  const [isEditingWhy, setIsEditingWhy] = useState(false);
  const [editedWhyText, setEditedWhyText] = useState("");
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [isLongGeneration, setIsLongGeneration] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  // Coaching modal state
  const [showCoachingModal, setShowCoachingModal] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'continue' | 'custom' | 'edit'; data?: any } | null>(null);

  const generateTreeMutation = useMutation({
    mutationFn: async () => {
      if (!understanding) {
        throw new Error('Understanding data not loaded. Please wait...');
      }
      
      const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/generate', {
        sessionId: understanding.sessionId,
        input: understanding.userInput,
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
    mutationFn: async ({ nodeId, parentQuestion, currentDepth, isCustom, customOption }: {
      nodeId: string;
      parentQuestion: string;
      currentDepth: number;
      isCustom?: boolean;
      customOption?: string;
    }) => {
      if (!understanding) {
        throw new Error('Understanding data not loaded. Please wait...');
      }
      
      const pathOptions = selectedPath.map(p => p.option);
      const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/expand', {
        sessionId: understanding.sessionId,
        nodeId,
        selectedPath: pathOptions,
        currentDepth,
        parentQuestion,
        input: understanding.userInput,
        isCustom: isCustom || false,
        customOption,
      });
      return response.json();
    },
    onSuccess: (data: any, variables) => {
      setIsProcessingAction(false);
      
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
      setIsProcessingAction(false);
      
      toast({
        title: "Expansion failed",
        description: error.message || "Failed to expand branch",
        variant: "destructive",
      });
    },
  });

  const validateRootCauseMutation = useMutation({
    mutationFn: async (rootCauseText: string) => {
      const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/validate-root-cause', {
        rootCauseText,
      });
      return response.json();
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async ({ rootCause, completePath }: { rootCause: string; completePath: string[] }) => {
      if (!understanding) {
        throw new Error('Understanding data not loaded. Please wait...');
      }
      
      const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/finalize', {
        sessionId: understanding.sessionId,
        selectedPath: completePath,
        rootCause,
        input: understanding.userInput,
      });
      return response.json();
    },
    onSuccess: (data: any, variables) => {
      setIsProcessingAction(false);
      
      if (!understanding) return;
      
      // Always use understanding.sessionId for localStorage keys and navigation
      // The journey session ID is only used for backend lookups, not routing
      localStorage.setItem(`strategic-rootCause-${understanding.sessionId}`, variables.rootCause);
      localStorage.setItem(`strategic-whysPath-${understanding.sessionId}`, JSON.stringify(variables.completePath));
      localStorage.setItem(`strategic-input-${understanding.sessionId}`, understanding.userInput);
      localStorage.setItem(`journey-type-${understanding.sessionId}`, understanding.journeyType || '');
      
      toast({
        title: "Root cause identified",
        description: "Proceeding to research phase",
      });
      setLocation(`/strategic-consultant/research/${understanding.sessionId}`);
    },
    onError: (error: any) => {
      setIsProcessingAction(false);
      
      toast({
        title: "Finalization failed",
        description: error.message || "Failed to finalize root cause",
        variant: "destructive",
      });
    },
  });

  // Validation mutation for Five Whys coaching
  const validateWhyMutation = useMutation({
    mutationFn: async ({ level, candidate, previousWhys, rootQuestion }: {
      level: number;
      candidate: string;
      previousWhys: string[];
      rootQuestion: string;
    }) => {
      const response = await apiRequest(
        'POST',
        '/api/strategic-consultant/five-whys/validate',
        {
          level,
          candidate,
          previousWhys,
          rootQuestion,
        }
      );
      return await response.json() as { success: boolean; evaluation: any };
    },
  });

  useEffect(() => {
    const fetchUnderstanding = async () => {
      if (!understandingId) {
        setIsLoadingUnderstanding(false);
        return;
      }
      
      setIsLoadingUnderstanding(true);
      try {
        const response = await fetch(`/api/strategic-consultant/understanding/${understandingId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch understanding');
        }
        const data = await response.json();
        
        // Check if there's a current journey session ID in localStorage
        const journeySessionId = localStorage.getItem(`current-journey-session-${data.id}`);
        
        // Fetch journey session to get journey type
        if (journeySessionId) {
          try {
            const journeyResponse = await fetch(`/api/strategic-consultant/journey-sessions/${journeySessionId}`);
            if (journeyResponse.ok) {
              const journeyData = await journeyResponse.json();
              if (journeyData.journeyType) {
                // Store journey type in localStorage for ResearchPage
                localStorage.setItem(`journey-type-${data.id}`, journeyData.journeyType);
                data.journeyType = journeyData.journeyType;
              }
            }
          } catch (journeyError) {
            console.warn('Could not fetch journey session:', journeyError);
          }
        }
        
        setUnderstanding(data);
      } catch (error: any) {
        toast({
          title: "Failed to load data",
          description: error.message || "Could not load strategic understanding",
          variant: "destructive",
        });
      } finally {
        setIsLoadingUnderstanding(false);
      }
    };
    
    fetchUnderstanding();
  }, [understandingId]);

  useEffect(() => {
    if (understanding) {
      generateTreeMutation.mutate();
    }
  }, [understanding]);

  // Timeout handler for long-running tree generation
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (generateTreeMutation.isPending) {
      setIsLongGeneration(false);
      timeoutId = setTimeout(() => {
        setIsLongGeneration(true);
      }, 30000); // 30 seconds
    } else {
      setIsLongGeneration(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [generateTreeMutation.isPending]);

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

  const handleSelectAndContinue = async () => {
    if (!currentOption || !tree) return;

    // Set loading state immediately for instant user feedback
    flushSync(() => {
      setIsProcessingAction(true);
    });

    // ONLY validate if this is a CUSTOM user input
    // System-provided Whys are already validated and don't need coaching
    const isUserCustomInput = currentOption.isCustom === true;

    if (isUserCustomInput) {
      try {
        // Validate the user's custom input
        const previousWhys = selectedPath.map(p => p.option);
        const validation = await validateWhyMutation.mutateAsync({
          level: currentLevel,
          candidate: currentOption.option,
          previousWhys,
          rootQuestion: tree.rootQuestion,
        });

        if (validation.success && validation.evaluation) {
          const { verdict } = validation.evaluation;

          if (verdict === 'invalid') {
            // Block progression - must revise
            setIsProcessingAction(false);
            setCurrentEvaluation(validation.evaluation);
            setPendingAction({ type: 'continue' });
            setShowCoachingModal(true);
            return;
          } else if (verdict === 'needs_clarification') {
            // Show warning but allow override
            setIsProcessingAction(false);
            setCurrentEvaluation(validation.evaluation);
            setPendingAction({ type: 'continue' });
            setShowCoachingModal(true);
            return;
          }
        }
      } catch (error) {
        setIsProcessingAction(false);
        toast({
          title: "Validation failed",
          description: "Failed to validate your answer. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    // If validation passes (acceptable) OR this is a system-provided option, proceed
    // Note: proceedWithContinue() will keep isProcessingAction true if expansion is needed
    proceedWithContinue();
  };

  const proceedWithContinue = (overrideOption?: string, overrideIsCustom?: boolean) => {
    if (!currentOption) return;

    // Use override values if provided (e.g., from revised answer), otherwise use current option
    const optionToUse = overrideOption ?? currentOption.option;
    const isCustomToUse = overrideIsCustom ?? currentOption.isCustom ?? false;

    // Check if we need to call expansion (no existing branches)
    const needsExpansion = !currentOption.branches || currentOption.branches.length === 0;
    
    // Note: isProcessingAction is already true from handleSelectAndContinue
    // Keep it true if expansion is needed, clear it if just navigating

    const newPath = [...selectedPath, {
      nodeId: currentOption.id,
      option: optionToUse, // Use the possibly-overridden option
      depth: currentOption.depth
    }];
    setSelectedPath(newPath);

    if (!needsExpansion) {
      // Branches exist, just navigate - clear loading state
      setCurrentLevel(prev => prev + 1);
      setCurrentOptionIndex(0);
      setIsProcessingAction(false);
    } else {
      // Need to expand - call mutation (loading state stays true, cleared in mutation onSuccess/onError)
      expandBranchMutation.mutate({
        nodeId: currentOption.id,
        parentQuestion: currentOption.question,
        currentDepth: currentOption.depth,
        isCustom: isCustomToUse, // Use the possibly-overridden custom flag
        customOption: isCustomToUse ? optionToUse : undefined, // Use the revised option if custom
      });
    }
  };

  const handleFinalize = async () => {
    if (!currentOption) return;
    
    // Set immediate processing state for instant UI feedback - use flushSync for instant UI update
    flushSync(() => {
      setIsProcessingAction(true);
    });
    
    // Validate root cause first
    try {
      const validation = await validateRootCauseMutation.mutateAsync(currentOption.option);
      
      if (!validation.valid) {
        // Show warning modal if validation fails
        setValidationMessage(validation.message || 'This root cause contains cultural observations instead of business problems.');
        setShowValidationWarning(true);
        setIsProcessingAction(false);
        return;
      }
      
      // If validation passes, proceed with finalization
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
    } catch (error: any) {
      setIsProcessingAction(false);
      toast({
        title: "Validation failed",
        description: error.message || "Failed to validate root cause",
        variant: "destructive",
      });
    }
  };

  const handleAddCustomWhy = () => {
    if (!customWhyText.trim() || !tree) return;

    const customNodeId = `custom-${Date.now()}`;
    const customNode: WhyNode = {
      id: customNodeId,
      question: `Why is this? (${customWhyText})`,
      option: customWhyText.trim(),
      depth: currentLevel,
      isLeaf: false,
      isCustom: true,
      supporting_evidence: [],
      counter_arguments: [],
      consideration: 'Custom option - evidence will be generated when expanded',
    };

    // Add custom option to current level
    if (currentLevel === 1) {
      setTree({
        ...tree,
        branches: [...tree.branches, customNode],
      });
      setCurrentOptionIndex(tree.branches.length); // Select the new custom option
    } else {
      // Navigate to the custom option's parent and add it there
      const updateTreeWithCustom = (nodes: WhyNode[]): WhyNode[] => {
        return nodes.map(node => {
          if (selectedPath.length > 0 && node.id === selectedPath[selectedPath.length - 1].nodeId) {
            return {
              ...node,
              branches: [...(node.branches || []), customNode],
            };
          }
          if (node.branches) {
            return { ...node, branches: updateTreeWithCustom(node.branches) };
          }
          return node;
        });
      };
      
      setTree({
        ...tree,
        branches: updateTreeWithCustom(tree.branches),
      });
      const currentOptionsLength = getCurrentOptions().length;
      setCurrentOptionIndex(currentOptionsLength); // Select the new custom option
    }

    setCustomWhyText("");
    toast({
      title: "Custom Why added",
      description: "You can now select and continue with your custom option",
    });
  };

  const handleEditWhy = () => {
    if (!currentOption || !editedWhyText.trim() || !tree) return;

    const updateNodeOption = (nodes: WhyNode[]): WhyNode[] => {
      return nodes.map(node => {
        if (node.id === currentOption.id) {
          return {
            ...node,
            option: editedWhyText.trim(),
            question: `Why is this? (${editedWhyText.trim()})`,
            isCustom: true, // Mark as custom after editing
          };
        }
        if (node.branches) {
          return { ...node, branches: updateNodeOption(node.branches) };
        }
        return node;
      });
    };

    setTree({
      ...tree,
      branches: updateNodeOption(tree.branches),
    });

    setIsEditingWhy(false);
    setEditedWhyText("");
    toast({
      title: "Why updated",
      description: "The option has been updated with your changes",
    });
  };

  const handleStartEdit = () => {
    if (currentOption) {
      setEditedWhyText(currentOption.option);
      setIsEditingWhy(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingWhy(false);
    setEditedWhyText("");
  };

  // Coaching modal handlers
  const handleRevision = async (newAnswer: string, isCoachGenerated: boolean = false) => {
    if (!tree || !pendingAction) return;

    if (pendingAction.type === 'continue' && currentOption) {
      // Close modal and show loading state
      setShowCoachingModal(false);
      flushSync(() => {
        setIsProcessingAction(true);
      });

      // If this is a coach-generated answer, auto-accept without re-validation
      if (isCoachGenerated) {
        // Coach's suggestion - accept it directly without re-validation
        setPendingAction(null);
        setCurrentEvaluation(null);
        toast({
          title: "Using coach's suggestion",
          description: "Proceeding with the improved answer",
        });
        proceedWithContinue(newAnswer, true);
        return;
      }

      try {
        // Only re-validate if user manually edited the answer
        const previousWhys = selectedPath.map(p => p.option);
        const validation = await validateWhyMutation.mutateAsync({
          level: currentLevel,
          candidate: newAnswer,
          previousWhys,
          rootQuestion: tree.rootQuestion,
        });

        if (validation.success && validation.evaluation) {
          const { verdict } = validation.evaluation;

          if (verdict === 'invalid' || verdict === 'needs_clarification') {
            // Still has issues - show coaching modal again with updated evaluation
            setIsProcessingAction(false);
            setCurrentEvaluation(validation.evaluation);
            setShowCoachingModal(true);
            toast({
              title: "Needs more improvement",
              description: "Your answer still needs refinement. Please review the feedback.",
              variant: "destructive",
            });
            return;
          }
        }

        // Validation passed (acceptable) - proceed with the revised answer
        setPendingAction(null);
        setCurrentEvaluation(null);
        toast({
          title: "Answer revised",
          description: "Your improved answer has been validated",
        });
        
        // Pass the revised answer explicitly to proceedWithContinue
        // It will be added to selectedPath and used for expansion
        // The backend will generate new options based on this revised answer
        proceedWithContinue(newAnswer, true);
      } catch (error) {
        setIsProcessingAction(false);
        toast({
          title: "Validation failed",
          description: "Failed to validate revised answer. Please try again.",
          variant: "destructive",
        });
      }
    } else if (pendingAction.type === 'custom') {
      // For custom Whys, check if it's the coach's suggestion first
      setShowCoachingModal(false);
      flushSync(() => {
        setIsProcessingAction(true);
      });

      // If this is a coach-generated answer, auto-accept without re-validation
      if (isCoachGenerated) {
        // Coach's suggestion - accept it directly without re-validation
        setPendingAction(null);
        setCurrentEvaluation(null);
        toast({
          title: "Using coach's suggestion",
          description: "Proceeding with the improved answer",
        });
        proceedWithContinue(newAnswer, true);
        return;
      }

      try {
        // Only re-validate if user manually edited the answer
        const previousWhys = selectedPath.map(p => p.option);
        const validation = await validateWhyMutation.mutateAsync({
          level: currentLevel,
          candidate: newAnswer,
          previousWhys,
          rootQuestion: tree.rootQuestion,
        });

        if (validation.success && validation.evaluation) {
          const { verdict } = validation.evaluation;

          if (verdict === 'invalid' || verdict === 'needs_clarification') {
            // Still has issues - show coaching modal again
            setIsProcessingAction(false);
            setCurrentEvaluation(validation.evaluation);
            setShowCoachingModal(true);
            toast({
              title: "Needs more improvement",
              description: "Your answer still needs refinement. Please review the feedback.",
              variant: "destructive",
            });
            return;
          }
        }

        // Validation passed - proceed with the revised answer
        setPendingAction(null);
        setCurrentEvaluation(null);
        toast({
          title: "Answer revised",
          description: "Your improved answer has been validated",
        });
        
        // Pass the revised answer explicitly via override
        // This will add it to selectedPath and use it for expansion
        proceedWithContinue(newAnswer, true);
      } catch (error) {
        setIsProcessingAction(false);
        toast({
          title: "Validation failed",
          description: "Failed to validate revised answer. Please try again.",
          variant: "destructive",
        });
      }
    } else if (pendingAction.type === 'edit') {
      setEditedWhyText(newAnswer);
      setShowCoachingModal(false);
      setPendingAction(null);
      setCurrentEvaluation(null);
    }
  };

  const handleOverride = () => {
    // Allow override only for needs_clarification, not invalid
    if (currentEvaluation?.verdict === 'invalid') {
      toast({
        title: "Cannot override",
        description: "This answer must be revised before continuing",
        variant: "destructive",
      });
      return;
    }

    setShowCoachingModal(false);
    setPendingAction(null);
    setCurrentEvaluation(null);
    
    if (pendingAction?.type === 'continue') {
      // Show loading state before proceeding
      flushSync(() => {
        setIsProcessingAction(true);
      });
      
      toast({
        title: "Continuing with current answer",
        description: "Proceeding as requested",
      });
      
      proceedWithContinue();
    }
  };

  const canShowRootCauseButton = currentLevel >= 3;
  const canShowContinueButton = currentLevel < 5;
  const showOnlyFinalize = currentLevel === 5;

  if (!understandingId) {
    return (
      <AppLayout title="Five Whys Analysis" subtitle="Error" onViewChange={() => {}}>
        <div className="flex items-center justify-center p-8">
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>No understanding ID provided</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  if (isLoadingUnderstanding || generateTreeMutation.isPending) {
    return (
      <AppLayout title="Five Whys Analysis" subtitle="Generating analysis..." onViewChange={() => {}}>
        <div className="flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">
              {isLoadingUnderstanding ? "Loading journey data..." : "Generating Five Whys analysis..."}
            </p>
            {!isLoadingUnderstanding && isLongGeneration && (
              <>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Generated Level 1 completely, Level 2 generating...
                </p>
                <p className="text-xs text-muted-foreground">This is taking longer than usual, please wait</p>
              </>
            )}
            {!isLoadingUnderstanding && !isLongGeneration && (
              <p className="text-sm text-muted-foreground">This may take 20-30 seconds</p>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!tree) {
    return (
      <AppLayout title="Five Whys Analysis" subtitle="Error loading" onViewChange={() => {}}>
        <div className="flex items-center justify-center p-8">
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>Failed to load decision tree</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Five Whys Analysis"
      subtitle="Discover root causes through strategic questioning"
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
              {/* Consideration Section (Always Visible) */}
              {currentOption.consideration && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4" data-testid="consideration-section">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-900 dark:text-blue-100">{currentOption.consideration}</p>
                  </div>
                </div>
              )}

              {/* Evidence Sections (Collapsible) */}
              {(currentOption.supporting_evidence?.length > 0 || currentOption.counter_arguments?.length > 0) && (
                <div className="space-y-3">
                  {/* Supporting Evidence */}
                  {currentOption.supporting_evidence?.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="w-full" data-testid="trigger-supporting-evidence">
                        <div className="flex items-center justify-between w-full p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors">
                          <span className="font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                            <span className="text-lg">✅</span>
                            Supporting Evidence
                          </span>
                          <ChevronDown className="h-4 w-4 text-green-700 dark:text-green-300" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4" data-testid="content-supporting-evidence">
                        <ul className="space-y-2">
                          {currentOption.supporting_evidence.map((point, i) => (
                            <li key={i} className="text-sm text-green-900 dark:text-green-100 flex gap-2">
                              <span className="text-green-600 dark:text-green-400 mt-1">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Counter-Arguments */}
                  {currentOption.counter_arguments?.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="w-full" data-testid="trigger-counter-arguments">
                        <div className="flex items-center justify-between w-full p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors">
                          <span className="font-medium text-amber-900 dark:text-amber-100 flex items-center gap-2">
                            <span className="text-lg">⚠️</span>
                            Counter-Arguments
                          </span>
                          <ChevronDown className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4" data-testid="content-counter-arguments">
                        <ul className="space-y-2">
                          {currentOption.counter_arguments.map((point, i) => (
                            <li key={i} className="text-sm text-amber-900 dark:text-amber-100 flex gap-2">
                              <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}

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

              {/* Edit Why Section */}
              {isEditingWhy ? (
                <div className="pt-4 border-t space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Edit this Why</label>
                    <Textarea
                      value={editedWhyText}
                      onChange={(e) => setEditedWhyText(e.target.value)}
                      placeholder="Edit your Why statement..."
                      rows={3}
                      data-testid="textarea-edit-why"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={handleEditWhy}
                      disabled={!editedWhyText.trim()}
                      data-testid="button-save-edit"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Edit Button */}
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEdit}
                      className="w-full"
                      data-testid="button-start-edit"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit this Why
                    </Button>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-3">
                    {!showOnlyFinalize && canShowContinueButton && (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleSelectAndContinue}
                        disabled={isProcessingAction || expandBranchMutation.isPending || finalizeMutation.isPending}
                        data-testid="button-continue"
                      >
                        {(isProcessingAction || expandBranchMutation.isPending) ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Loading next level...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="h-5 w-5 mr-2" />
                            Continue to next Why
                          </>
                        )}
                      </Button>
                    )}

                    {canShowRootCauseButton && (
                      <Button
                        variant={showOnlyFinalize ? "default" : "secondary"}
                        className="w-full"
                        size="lg"
                        onClick={handleFinalize}
                        disabled={isProcessingAction || validateRootCauseMutation.isPending || finalizeMutation.isPending}
                        data-testid="button-finalize"
                      >
                        {(isProcessingAction || validateRootCauseMutation.isPending || finalizeMutation.isPending) ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            {validateRootCauseMutation.isPending ? "Validating..." : "Processing..."}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            This is my root cause
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <AlertDescription>No options available at this level</AlertDescription>
          </Alert>
        )}

        {/* Custom Why Input Section */}
        {!expandBranchMutation.isPending && (
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Add your own Why</label>
                </div>
                <Textarea
                  value={customWhyText}
                  onChange={(e) => setCustomWhyText(e.target.value)}
                  placeholder="If none of the options fit, type your own Why statement here..."
                  rows={2}
                  data-testid="textarea-custom-why"
                />
                <Button
                  variant="outline"
                  onClick={handleAddCustomWhy}
                  disabled={!customWhyText.trim()}
                  className="w-full"
                  data-testid="button-add-custom-why"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Why
                </Button>
              </div>
            </CardContent>
          </Card>
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

      {/* Validation Warning Modal */}
      <AlertDialog open={showValidationWarning} onOpenChange={setShowValidationWarning}>
        <AlertDialogContent data-testid="dialog-validation-warning">
          <AlertDialogHeader>
            <AlertDialogTitle>Cultural Observation Detected</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{validationMessage}</p>
              <p className="text-sm mt-2">
                Please select a different branch that focuses on market dynamics, competitive positioning, or product-market fit.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowValidationWarning(false)} data-testid="button-go-back">
              Go Back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Coaching Modal */}
      {currentEvaluation && tree && (
        <CoachingModal
          open={showCoachingModal}
          onOpenChange={setShowCoachingModal}
          evaluation={currentEvaluation}
          candidate={currentOption?.option || customWhyText || editedWhyText}
          rootQuestion={tree.rootQuestion}
          previousWhys={selectedPath.map(p => p.option)}
          sessionId={tree.sessionId}
          onRevise={handleRevision}
          onOverride={handleOverride}
        />
      )}
    </AppLayout>
  );
}
