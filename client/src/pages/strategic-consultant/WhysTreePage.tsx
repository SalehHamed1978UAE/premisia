import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ChevronLeft, ChevronRight, ArrowRight, CheckCircle2, Edit, Plus, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, Pencil } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { CoachingModal } from "@/components/five-whys/CoachingModal";
import { FiveWhysAnimation } from "@/components/five-whys-animation/FiveWhysAnimation";

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

// NEW: Levels-array state model
type LevelState =
  | {
      depth: number;
      status: "ready";
      parentId?: string;
      nodes: WhyNode[];
      selectedId?: string;
    }
  | {
      depth: number;
      status: "loading";
      parentId?: string;
    };

interface WhysTreeState {
  rootQuestion: string;
  levels: LevelState[];
  activeDepth: number;
  maxDepth: number;
}

export default function WhysTreePage() {
  const [, params] = useRoute("/strategic-consultant/whys-tree/:understandingId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const understandingId = params?.understandingId;

  const [understanding, setUnderstanding] = useState<{ id: string; sessionId: string; userInput: string; journeyType?: string } | null>(null);
  const [journeySessionId, setJourneySessionId] = useState<string | null>(null);
  const [isLoadingUnderstanding, setIsLoadingUnderstanding] = useState(true);

  // NEW: Levels-based state (replaces tree, selectedPath, currentLevel, selectedOptionId)
  const [whysState, setWhysState] = useState<WhysTreeState | null>(null);

  // UI state
  const [customWhyText, setCustomWhyText] = useState("");
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [sheetContent, setSheetContent] = useState<{ type: 'consider' | 'evidence' | 'counter', option: WhyNode } | null>(null);

  // Cache for prefetched branches
  const branchCache = useRef(new Map<string, WhyNode[]>());

  const getCacheKey = (sessionId: string, nodeId: string, depth: number) =>
    `${sessionId}:${nodeId}:${depth}`;

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
      // Initialize levels-based state from tree response
      const tree: WhyTree = data.tree;
      setWhysState({
        rootQuestion: tree.rootQuestion,
        maxDepth: tree.maxDepth,
        activeDepth: 1,
        levels: [
          {
            depth: 1,
            status: "ready",
            nodes: tree.branches,
            selectedId: undefined,
          }
        ]
      });
    },
    onError: (error: any) => {
      toast({
        title: "Tree generation failed",
        description: error.message || "Failed to generate decision tree",
        variant: "destructive",
      });
    },
  });

  // Fetch children for a node (with caching)
  const fetchChildren = async (nodeId: string, depth: number, node: WhyNode): Promise<WhyNode[]> => {
    if (!understanding) throw new Error('Understanding not loaded');

    const cacheKey = getCacheKey(understanding.sessionId, nodeId, depth);

    // Check cache first
    if (branchCache.current.has(cacheKey)) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return branchCache.current.get(cacheKey)!;
    }

    // Build path history from levels
    const pathHistory: Array<{ question: string; answer: string }> = [];
    if (whysState) {
      for (let i = 0; i < whysState.levels.length; i++) {
        const level = whysState.levels[i];
        if (level.status === "ready" && level.selectedId) {
          const selected = level.nodes.find(n => n.id === level.selectedId);
          if (selected) {
            pathHistory.push({ question: selected.question, answer: selected.option });
          }
        }
      }
    }

    // Get siblings for prefetch
    const currentLevel = whysState?.levels[depth - 1];
    const siblings = currentLevel && currentLevel.status === "ready" ? currentLevel.nodes : [];
    const strippedSiblings = siblings.map(opt => ({
      id: opt.id,
      question: opt.question,
      option: opt.option,
      depth: opt.depth
    }));

    const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/expand', {
      sessionId: understanding.sessionId,
      nodeId,
      selectedPath: pathHistory,
      currentDepth: depth,
      parentQuestion: node.question,
      input: understanding.userInput,
      allSiblings: strippedSiblings,
    });

    const data = await response.json();

    // Show toast for cache hits from server
    if (data.fromCache) {
      toast({
        title: "⚡ Instant",
        description: "Already prepared this path",
        duration: 2000,
      });
    }

    // Track prefetch
    if (data.prefetchStarted) {
      setIsPrefetching(true);
      setTimeout(() => setIsPrefetching(false), 20000);
    }

    const children: WhyNode[] = data.expandedBranches || [];

    // Cache the result
    branchCache.current.set(cacheKey, children);

    return children;
  };

  // Core expansion function: selectNode
  const selectNode = async (depth: number, nodeId: string) => {
    if (!whysState || !understanding) return;

    const level = whysState.levels[depth - 1];
    if (!level || level.status !== "ready") return;

    const node = level.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Don't expand if already at max depth
    if (depth >= whysState.maxDepth) {
      // Just mark as selected
      setWhysState(prev => {
        if (!prev) return null;
        const next = { ...prev };
        const targetLevel = next.levels[depth - 1];
        if (targetLevel.status === "ready") {
          targetLevel.selectedId = nodeId;
        }
        return next;
      });
      return;
    }

    // 1) Mark selection + append loading placeholder
    setWhysState(prev => {
      if (!prev) return null;
      const next = { ...prev, activeDepth: depth + 1 };
      const levels = [...next.levels];

      // Update selection
      const targetLevel = levels[depth - 1];
      if (targetLevel.status === "ready") {
        targetLevel.selectedId = nodeId;
      }

      // Truncate levels beyond current depth and add loading placeholder
      levels.splice(depth);
      levels[depth] = {
        depth: depth + 1,
        status: "loading",
        parentId: nodeId,
      };

      next.levels = levels;
      return next;
    });

    // 2) Fetch children
    try {
      const children = await fetchChildren(nodeId, depth, node);

      // 3) Replace loading placeholder with real nodes
      setWhysState(prev => {
        if (!prev) return null;
        const next = { ...prev };
        const levels = [...next.levels];

        levels[depth] = {
          depth: depth + 1,
          status: "ready",
          parentId: nodeId,
          nodes: children,
          selectedId: undefined,
        };

        next.levels = levels;
        return next;
      });
    } catch (error: any) {
      // Remove loading placeholder on error
      setWhysState(prev => {
        if (!prev) return null;
        const next = { ...prev };
        next.levels = next.levels.slice(0, depth);
        return next;
      });

      toast({
        title: "Expansion failed",
        description: error.message || "Failed to expand branch",
        variant: "destructive",
      });
    }
  };

  const validateRootCauseMutation = useMutation({
    mutationFn: async (rootCauseText: string) => {
      const response = await apiRequest('POST', '/api/strategic-consultant/whys-tree/validate-root-cause', {
        rootCauseText,
      });
      return response.json();
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async ({ rootCause, completePath }: { rootCause: string; completePath: Array<{question: string; answer: string}> }) => {
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
      // Use journey session ID for navigation (critical for follow-on journeys)
      // Fall back to understanding.sessionId for legacy flows
      const sessionIdForNavigation = journeySessionId || understanding.sessionId;
      
      localStorage.setItem(`strategic-rootCause-${sessionIdForNavigation}`, variables.rootCause);
      localStorage.setItem(`strategic-whysPath-${sessionIdForNavigation}`, JSON.stringify(variables.completePath));
      localStorage.setItem(`strategic-input-${sessionIdForNavigation}`, understanding.userInput);
      localStorage.setItem(`journey-type-${sessionIdForNavigation}`, understanding.journeyType || '');
      
      toast({
        title: "Root cause identified",
        description: "Proceeding to research phase",
      });
      setLocation(`/strategic-consultant/research/${sessionIdForNavigation}`);
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

  // Helper Functions
  const getOrdinalLabel = (level: number): string => {
    const labels = ['1st', '2nd', '3rd', '4th', '5th'];
    return labels[level - 1] || `${level}th`;
  };

  const getCurrentQuestion = (): string => {
    if (!tree) return '';
    
    // Level 1: root question
    if (currentLevel === 1) {
      return tree.rootQuestion;
    }
    
    // For level 2+: the current question is stored in the parent node's question field
    // The parent is the last item in selectedPath
    if (selectedPath.length > 0) {
      // Navigate to the last selected node (the parent of current options)
      let currentNodes = tree.branches;
      for (let i = 0; i < selectedPath.length; i++) {
        const selectedNode = currentNodes.find(n => n.id === selectedPath[i].nodeId);
        if (!selectedNode) return `Why ${selectedPath[i].answer}?`;
        
        // If this is the last item in path, return its question field
        // This is the question for the CURRENT level (children of this node)
        if (i === selectedPath.length - 1) {
          return selectedNode.question;
        }
        
        // Otherwise continue navigating
        if (selectedNode.branches) {
          currentNodes = selectedNode.branches;
        }
      }
    }
    
    // Fallback: construct question from last selected option
    if (selectedPath.length > 0) {
      return `Why ${selectedPath[selectedPath.length - 1].answer}?`;
    }
    
    return '';
  };

  const handleIconClick = (type: 'consider' | 'evidence' | 'counter', option: WhyNode) => {
    setSheetContent({ type, option });
  };

  // Scroll event listener for carousel centering (mobile only)
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 640) {
      return; // Only on mobile
    }
    
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const findCenteredOption = () => {
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;

      let closestOption: string | null = null;
      let minDistance = Infinity;

      optionRefs.current.forEach((element, optionId) => {
        const rect = element.getBoundingClientRect();
        const elementCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(centerY - elementCenterY);

        if (distance < minDistance) {
          minDistance = distance;
          closestOption = optionId;
        }
      });

      if (closestOption && closestOption !== centeredOptionId) {
        setCenteredOptionId(closestOption);
      }
    };

    // Find centered option on scroll
    container.addEventListener('scroll', findCenteredOption);
    
    // Initial check after mount
    setTimeout(findCenteredOption, 100);

    return () => {
      container.removeEventListener('scroll', findCenteredOption);
    };
  }, [tree, selectedPath, currentLevel, centeredOptionId]); // Re-run when navigation state changes

  // Reset isAnswerSelected when user scrolls to different option
  useEffect(() => {
    if (isAnswerSelected) {
      setIsAnswerSelected(false);
    }
  }, [centeredOptionId]); // Only depend on centeredOptionId to avoid infinite loop

  // Reset isAnswerSelected when navigating to a new level
  useEffect(() => {
    setIsAnswerSelected(false);
  }, [currentLevel]);

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
        const storedJourneySessionId = localStorage.getItem(`current-journey-session-${data.id}`);
        
        // Fetch journey session to get journey type and session ID
        if (storedJourneySessionId) {
          try {
            const journeyResponse = await fetch(`/api/strategic-consultant/journey-sessions/${storedJourneySessionId}`);
            if (journeyResponse.ok) {
              const journeyData = await journeyResponse.json();
              if (journeyData.journeyType) {
                // Store journey type using understanding.sessionId (consistent with URL routing)
                localStorage.setItem(`journey-type-${data.sessionId}`, journeyData.journeyType);
                data.journeyType = journeyData.journeyType;
              }
              // Store journey session ID for navigation
              setJourneySessionId(storedJourneySessionId);
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
  const selectedOption = currentOptions.find(o => o.id === selectedOptionId);

  // Set initial centered option for mobile scroll-snap
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 640) return; // Only on mobile
    
    if (currentOptions.length > 0 && !centeredOptionId) {
      console.log('[Initial Center] Setting first option as centered:', currentOptions[0].id);
      setCenteredOptionId(currentOptions[0].id);
    }
  }, [currentOptions.length, centeredOptionId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Guard: Don't intercept if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Guard: Don't intercept if modal/dialog is open
      if (document.querySelector('[role="dialog"]') || showCoachingModal || isEditingWhy) {
        return;
      }

      // Guard: Don't intercept if processing
      if (isProcessingAction || expandBranchMutation.isPending || finalizeMutation.isPending) {
        return;
      }

      const currentOptions = getCurrentOptions();
      if (currentOptions.length === 0) return;

      const currentIndex = selectedOptionId
        ? currentOptions.findIndex(o => o.id === selectedOptionId)
        : -1;

      switch(e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedOptionId(currentOptions[currentIndex - 1].id);
          } else if (currentIndex === -1 && currentOptions.length > 0) {
            setSelectedOptionId(currentOptions[0].id);
          }
          break;

        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < currentOptions.length - 1) {
            setSelectedOptionId(currentOptions[currentIndex + 1].id);
          } else if (currentIndex === -1 && currentOptions.length > 0) {
            setSelectedOptionId(currentOptions[0].id);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedOptionId) {
            handleSelectAndContinue();
          }
          break;

        case 'Backspace':
          e.preventDefault();
          if (selectedPath.length > 0) {
            handleGoBack();
          }
          break;

        case 'Escape':
          e.preventDefault();
          setSelectedOptionId(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedOptionId, currentLevel, isProcessingAction, expandBranchMutation.isPending, finalizeMutation.isPending, showCoachingModal, isEditingWhy, selectedPath.length]);

  const handleSelectAndContinue = async () => {
    if (!selectedOption || !tree) return;

    // Set loading state immediately for instant user feedback
    flushSync(() => {
      setIsProcessingAction(true);
    });

    // ONLY validate if this is a CUSTOM user input
    // System-provided Whys are already validated and don't need coaching
    const isUserCustomInput = selectedOption.isCustom === true;

    if (isUserCustomInput) {
      try {
        // Validate the user's custom input
        const previousWhys = selectedPath.map(p => p.answer);
        const validation = await validateWhyMutation.mutateAsync({
          level: currentLevel,
          candidate: selectedOption.option,
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
    if (!selectedOption) return;

    // Use override values if provided (e.g., from revised answer), otherwise use current option
    const optionToUse = overrideOption ?? selectedOption.option;
    const isCustomToUse = overrideIsCustom ?? selectedOption.isCustom ?? false;

    // Check if we need to call expansion (no existing branches)
    const needsExpansion = !selectedOption.branches || selectedOption.branches.length === 0;
    
    // Note: isProcessingAction is already true from handleSelectAndContinue
    // Keep it true if expansion is needed, clear it if just navigating

    // Capture the CURRENT question that was asked, not the next one
    const currentQuestion = getCurrentQuestion();

    const newPath = [...selectedPath, {
      nodeId: selectedOption.id,
      question: currentQuestion, // The question that was actually asked
      answer: optionToUse, // Use the possibly-overridden option
      depth: selectedOption.depth
    }];
    setSelectedPath(newPath);

    if (!needsExpansion) {
      // Branches exist, just navigate - clear loading state
      setCurrentLevel(prev => prev + 1);
      setSelectedOptionId(null);
      setIsProcessingAction(false);
    } else {
      // Need to expand - call mutation (loading state stays true, cleared in mutation onSuccess/onError)
      expandBranchMutation.mutate({
        nodeId: selectedOption.id,
        parentQuestion: selectedOption.question,
        currentDepth: selectedOption.depth,
        isCustom: isCustomToUse, // Use the possibly-overridden custom flag
        customOption: isCustomToUse ? optionToUse : undefined, // Use the revised option if custom
      });
    }
  };

  const handleFinalize = async () => {
    if (!selectedOption) return;
    
    // Don't set isProcessingAction here - the mutation states will handle loading
    // This prevents BOTH buttons from showing loading
    
    // Validate root cause first
    try {
      const validation = await validateRootCauseMutation.mutateAsync(selectedOption.option);
      
      if (!validation.valid) {
        // Show warning modal if validation fails
        setValidationMessage(validation.message || 'This root cause contains cultural observations instead of business problems.');
        setShowValidationWarning(true);
        return;
      }
      
      // If validation passes, proceed with finalization
      // Capture the CURRENT question that was asked, not the next one
      const currentQuestion = getCurrentQuestion();
      
      const finalPath = [...selectedPath, {
        nodeId: selectedOption.id,
        question: currentQuestion, // The question that was actually asked
        answer: selectedOption.option,
        depth: selectedOption.depth
      }];
      
      const pathHistory = finalPath.map(p => ({ question: p.question, answer: p.answer }));
      finalizeMutation.mutate({
        rootCause: selectedOption.option,
        completePath: pathHistory
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
      setSelectedOptionId(customNodeId); // Select the new custom option
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
      setSelectedOptionId(customNodeId); // Select the new custom option
    }

    setCustomWhyText("");
    toast({
      title: "Custom Why added",
      description: "You can now select and continue with your custom option",
    });
  };

  const handleEditWhy = () => {
    if (!selectedOption || !editedWhyText.trim() || !tree) return;

    const updateNodeOption = (nodes: WhyNode[]): WhyNode[] => {
      return nodes.map(node => {
        if (node.id === selectedOption.id) {
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
    if (selectedOption) {
      setEditedWhyText(selectedOption.option);
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

    if (pendingAction.type === 'continue' && selectedOption) {
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
        const previousWhys = selectedPath.map(p => p.answer);
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
        const previousWhys = selectedPath.map(p => p.answer);
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

  // Error states
  if (!understandingId) {
    return (
      <AppLayout title="Five Whys Analysis" subtitle="Error">
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
      <AppLayout title="Five Whys Analysis" subtitle="Generating analysis...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">Generating Five Whys Analysis</p>
            <p className="text-sm text-muted-foreground">This may take a moment...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!whysState) {
    return (
      <AppLayout title="Five Whys Analysis" subtitle="Error loading">
        <div className="flex items-center justify-center p-8">
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>Failed to load Five Whys analysis</AlertDescription>
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
      <div className="max-w-4xl mx-auto space-y-2 sm:space-y-6 p-2 sm:p-0">
        {/* Part 1: Breadcrumb - Simple at Level 1, Collapsible at Level 2+ */}
        {currentLevel === 1 ? (
          /* Level 1: Large faded number background */
          <div className="relative py-2 px-3 sm:py-4 sm:px-0" data-testid="breadcrumb-level-1">
            {/* Large faded background number */}
            <div className="absolute inset-0 flex items-center justify-start opacity-5 pointer-events-none overflow-hidden">
              <span className="text-[120px] sm:text-[140px] font-black leading-none">1</span>
            </div>
            {/* Question text */}
            <p className="relative text-base sm:text-lg font-bold text-primary">
              {getCurrentQuestion()}
            </p>
          </div>
        ) : (
          /* Level 2+: Show collapsible breadcrumb */
          <Collapsible open={isBreadcrumbExpanded} onOpenChange={setIsBreadcrumbExpanded}>
            <Card className="bg-muted/30" data-testid="breadcrumb-card">
              <CardContent className="p-4">
                <CollapsibleTrigger asChild>
                  <button 
                    className="flex items-center justify-between w-full text-left group"
                    data-testid="breadcrumb-toggle"
                  >
                    <span className="text-sm font-medium text-muted-foreground">
                      Your Path So Far...
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isBreadcrumbExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>

                <div className="mt-3 space-y-2">
                  {/* When collapsed - show only current question with faded number background */}
                  {!isBreadcrumbExpanded && (
                    <div className="relative py-2" data-testid="breadcrumb-current-collapsed">
                      {/* Large faded background number */}
                      <div className="absolute inset-0 flex items-center justify-start opacity-5 pointer-events-none overflow-hidden">
                        <span className="text-[120px] sm:text-[140px] font-black leading-none">{currentLevel}</span>
                      </div>
                      {/* Question text */}
                      <p className="relative text-base sm:text-lg font-bold text-primary">
                        {getCurrentQuestion()}
                      </p>
                    </div>
                  )}

                {/* When expanded - show full path */}
                <CollapsibleContent className="space-y-3">
                  {/* Root question */}
                  <div className="flex items-start gap-2" data-testid="breadcrumb-root">
                    <Badge variant="outline" className="shrink-0 mt-1">
                      1st
                    </Badge>
                    <div className="flex-1">
                      <p className={currentLevel === 1 ? "text-lg font-bold text-primary" : "text-sm text-muted-foreground"}>
                        {tree.rootQuestion}
                      </p>
                      {selectedPath.length > 0 && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <ArrowRight className="h-3 w-3" />
                          <span>{selectedPath[0].answer}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Previous whys (exclude current level) */}
                  {selectedPath.slice(0, -1).map((pathItem, idx) => {
                    // Get the question for this level by navigating to the node's branches
                    let questionText = `Why ${pathItem.answer}?`;
                    if (tree) {
                      let currentNodes = tree.branches;
                      for (let i = 0; i <= idx; i++) {
                        const node = currentNodes.find(n => n.id === selectedPath[i].nodeId);
                        if (!node) break;
                        
                        // If this is the target level and has branches, get question from first branch
                        if (i === idx && node.branches && node.branches.length > 0) {
                          questionText = node.branches[0].question;
                          break;
                        }
                        
                        if (node.branches) {
                          currentNodes = node.branches;
                        }
                      }
                    }
                    
                    return (
                      <div key={idx} className="flex items-start gap-2" data-testid={`breadcrumb-item-${idx}`}>
                        <Badge variant="outline" className="shrink-0 mt-1">
                          {getOrdinalLabel(idx + 2)}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">
                            {questionText}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <ArrowRight className="h-3 w-3" />
                            <span>{selectedPath[idx + 1].answer}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </CollapsibleContent>
                </div>
              </CardContent>
            </Card>
          </Collapsible>
        )}

        {/* Options display */}
        {currentOptions.length > 0 ? (
          <>
            {/* Part 2: Mobile Carousel Wheel & Desktop Grid */}
            {/* Mobile: Carousel Wheel Picker (<640px) */}
            <div className="sm:hidden relative">
              {/* Fixed viewport window with fade masks */}
              <div className="relative h-[280px] overflow-hidden border-2 border-primary/30 rounded-lg bg-background/50">
                {/* Top fade mask with scroll indicator */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background via-background/70 to-transparent z-10 pointer-events-none" />
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none" data-testid="scroll-indicator-up">
                  <ChevronUp className="h-5 w-5 text-muted-foreground/60 animate-bounce" />
                </div>
                
                {/* Bottom fade mask with scroll indicator */}
                <div className="absolute bottom-12 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/70 to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none" data-testid="scroll-indicator-down">
                  <ChevronDown className="h-5 w-5 text-muted-foreground/60 animate-bounce" />
                </div>
                
                {/* Center highlight window - removed horizontal lines, kept subtle background */}
                <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[110px] pointer-events-none z-0 bg-primary/5" />

                {/* Scrollable content */}
                <div
                  ref={scrollContainerRef}
                  className="h-[calc(100%-48px)] overflow-y-auto px-3 py-[100px]"
                  style={{
                    scrollSnapType: 'y mandatory',
                  }}
                  data-testid="options-mobile-scroll"
                >
                  {currentOptions.map((option) => {
                    const isCentered = centeredOptionId === option.id;
                    const isSelected = selectedOptionId === option.id;

                    return (
                      <div
                        key={option.id}
                        ref={(el) => {
                          if (el) optionRefs.current.set(option.id, el);
                          else optionRefs.current.delete(option.id);
                        }}
                        data-option-id={option.id}
                        style={{
                          scrollSnapAlign: 'center',
                          transform: isCentered ? 'scale(1.05)' : 'scale(1)',
                          opacity: isCentered ? 1 : 0.5,
                          transition: 'transform 250ms ease, opacity 250ms ease',
                        }}
                        className="mb-3 last:mb-0"
                      >
                        <Card
                          className={`cursor-pointer transition-all relative ${
                            isSelected
                              ? 'border-primary bg-primary/10 shadow-lg'
                              : isCentered
                              ? 'border-primary/50 shadow-md'
                              : 'border-border'
                          }`}
                          onClick={() => {
                            // Scroll clicked option to center
                            const element = optionRefs.current.get(option.id);
                            if (element) {
                              element.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                              });
                            }
                          }}
                          data-testid={`option-card-mobile-${option.id}`}
                        >
                          <CardContent className="p-2.5 relative">
                            {/* Pencil icon for editing */}
                            <button
                              className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors opacity-60 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOptionId(option.id);
                                setEditedWhyText(option.option);
                                setIsEditingWhy(true);
                              }}
                              data-testid="button-edit-option"
                              title="Edit this option"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            
                            <p className="font-medium text-sm pr-6">{option.option}</p>

                            {/* Icon Action Bar - Only show on centered option */}
                            {isCentered && (
                              <div className="flex items-center justify-center gap-3 mt-2.5" data-testid="icon-action-bar">
                                {option.consideration && (
                                  <button
                                    className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors animate-wiggle"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleIconClick('consider', option);
                                    }}
                                    data-testid="button-consider"
                                    title="View considerations"
                                  >
                                    <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                  </button>
                                )}
                                {option.supporting_evidence?.length > 0 && (
                                  <button
                                    className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors animate-wiggle"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleIconClick('evidence', option);
                                    }}
                                    data-testid="button-evidence"
                                    title="View supporting evidence"
                                  >
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  </button>
                                )}
                                {option.counter_arguments?.length > 0 && (
                                  <button
                                    className="p-2 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors animate-wiggle"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleIconClick('counter', option);
                                    }}
                                    data-testid="button-counter"
                                    title="View counter-arguments"
                                  >
                                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                  </button>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
                
                {/* Select button integrated into frame */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-primary/20 to-transparent z-20 flex items-end justify-center pb-2">
                  <Button
                    onClick={() => {
                      if (!centeredOptionId) return;
                      
                      if (!isAnswerSelected) {
                        // First click: select the answer
                        setSelectedOptionId(centeredOptionId);
                        setIsAnswerSelected(true);
                      } else {
                        // Second click: finalize if at max depth, otherwise continue
                        if (currentLevel >= 5) {
                          handleFinalize();
                        } else {
                          handleSelectAndContinue();
                        }
                      }
                    }}
                    disabled={!centeredOptionId || isProcessingAction || expandBranchMutation.isPending || finalizeMutation.isPending || validateRootCauseMutation.isPending}
                    size="lg"
                    className={`text-base font-semibold min-h-[44px] px-8 shadow-xl hover:shadow-2xl ${isAnswerSelected ? 'animate-pulse-glow' : ''}`}
                    data-testid="button-select-answer"
                  >
                    {(isProcessingAction || expandBranchMutation.isPending || finalizeMutation.isPending || validateRootCauseMutation.isPending) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {finalizeMutation.isPending || validateRootCauseMutation.isPending ? 'Finalizing...' : 'Loading...'}
                      </>
                    ) : isAnswerSelected ? (
                      currentLevel >= 5 ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          This is my root cause
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Continue
                        </>
                      )
                    ) : (
                      'Select This Answer'
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop: Grid Layout (≥640px) */}
            <div className="hidden sm:grid sm:grid-cols-2 gap-3 md:gap-4" data-testid="options-grid">
              {currentOptions.map((option) => (
                <Card
                  key={option.id}
                  className={`cursor-pointer transition-all min-h-[44px] ${
                    selectedOptionId === option.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'hover:border-primary/50 hover:shadow-sm'
                  }`}
                  onClick={() => setSelectedOptionId(option.id)}
                  data-testid={`option-card-${option.id}`}
                >
                  <CardContent className="p-4 relative">
                    {/* Pencil icon for editing */}
                    <button
                      className="absolute top-3 right-3 p-1 rounded hover:bg-muted transition-colors opacity-60 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOptionId(option.id);
                        setEditedWhyText(option.option);
                        setIsEditingWhy(true);
                      }}
                      data-testid="button-edit-option"
                      title="Edit this option"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    
                    <p className="font-medium text-base pr-8">{option.option}</p>
                    {option.consideration && (
                      <div className="mt-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-blue-900 dark:text-blue-100">{option.consideration}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Continue Button (hidden on mobile) - Positioned directly under cards */}
            <div className="hidden sm:flex justify-center mt-6">
              <div className="w-full md:w-auto flex flex-col gap-3">
                {!showOnlyFinalize && canShowContinueButton && (
                  <Button
                    className={`w-full md:w-auto md:min-w-[280px] transition-all ${
                      !selectedOptionId 
                        ? 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed' 
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                    size="lg"
                    onClick={handleSelectAndContinue}
                    disabled={!selectedOptionId || isProcessingAction || expandBranchMutation.isPending || finalizeMutation.isPending}
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
                        Continue to Next Why
                      </>
                    )}
                  </Button>
                )}

                {canShowRootCauseButton && (
                  <Button
                    variant={showOnlyFinalize ? "default" : "secondary"}
                    className="w-full md:w-auto md:min-w-[280px]"
                    size="lg"
                    onClick={handleFinalize}
                    disabled={!selectedOptionId || validateRootCauseMutation.isPending || finalizeMutation.isPending}
                    data-testid="button-finalize"
                  >
                    {(validateRootCauseMutation.isPending || finalizeMutation.isPending) ? (
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
            </div>

            {/* Desktop Evidence Box - Shows below continue button */}
            {selectedOption && (selectedOption.supporting_evidence?.length > 0 || selectedOption.counter_arguments?.length > 0) && (
              <Card className="hidden sm:block border-primary/50 bg-muted/50 mt-6" data-testid="evidence-box">
                <CardHeader>
                  <CardTitle className="text-base">Evidence for: {selectedOption.option}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Supporting Evidence */}
                  {selectedOption.supporting_evidence?.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4" data-testid="supporting-evidence">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">✅</span>
                        <span className="font-medium text-green-900 dark:text-green-100 text-sm">Supporting Evidence</span>
                      </div>
                      <ul className="space-y-2">
                        {selectedOption.supporting_evidence.map((point, i) => (
                          <li key={i} className="text-sm text-green-900 dark:text-green-100 flex gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Counter-Arguments */}
                  {selectedOption.counter_arguments?.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4" data-testid="counter-arguments">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">⚠️</span>
                        <span className="font-medium text-amber-900 dark:text-amber-100 text-sm">Counter-Arguments</span>
                      </div>
                      <ul className="space-y-2">
                        {selectedOption.counter_arguments.map((point, i) => (
                          <li key={i} className="text-sm text-amber-900 dark:text-amber-100 flex gap-2">
                            <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Edit Section - Only for selected option (hidden on mobile) */}
            {selectedOption && (
              <Card className="hidden sm:block border-dashed mt-6">
                <CardContent className="p-4">
                  {isEditingWhy ? (
                    <div className="space-y-3">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEdit}
                      className="w-full"
                      data-testid="button-start-edit"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit selected Why
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Skeleton loader for expanding branch */}
            {expandBranchMutation.isPending && selectedOptionId && (
              <Card className="border-dashed border-2 animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Generating next level of Whys... (10-15 seconds)
                  </p>
                </CardContent>
              </Card>
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
          </>
        ) : (
          <Alert>
            <AlertDescription>No options available at this level</AlertDescription>
          </Alert>
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
          candidate={selectedOption?.option || customWhyText || editedWhyText}
          rootQuestion={tree.rootQuestion}
          previousWhys={selectedPath.map(p => p.answer)}
          sessionId={tree.sessionId}
          onRevise={handleRevision}
          onOverride={handleOverride}
        />
      )}

      {/* Mobile Edit Dialog */}
      <Dialog open={isEditingWhy} onOpenChange={setIsEditingWhy}>
        <DialogContent className="sm:max-w-[425px]" data-testid="dialog-edit-why">
          <DialogHeader>
            <DialogTitle>Edit this Why</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={editedWhyText}
              onChange={(e) => setEditedWhyText(e.target.value)}
              placeholder="Edit your Why statement..."
              rows={4}
              data-testid="textarea-edit-why-mobile"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              className="w-full sm:w-auto"
              data-testid="button-cancel-edit-mobile"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditWhy}
              disabled={!editedWhyText.trim()}
              className="w-full sm:w-auto"
              data-testid="button-save-edit-mobile"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Sheet for detailed content */}
      <Sheet open={!!sheetContent} onOpenChange={(open) => !open && setSheetContent(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto" data-testid="detail-sheet">
          {sheetContent && (
            <>
              <SheetHeader>
                <SheetTitle data-testid="sheet-title">
                  {sheetContent.type === 'consider' && 'Consider This'}
                  {sheetContent.type === 'evidence' && 'Supporting Evidence'}
                  {sheetContent.type === 'counter' && 'Counter-Arguments'}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                {sheetContent.type === 'consider' && sheetContent.option.consideration && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-900 dark:text-blue-100">{sheetContent.option.consideration}</p>
                    </div>
                  </div>
                )}

                {sheetContent.type === 'evidence' && sheetContent.option.supporting_evidence && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-900 dark:text-green-100">Supporting Evidence</span>
                    </div>
                    <ul className="space-y-2">
                      {sheetContent.option.supporting_evidence.map((point, i) => (
                        <li key={i} className="text-sm text-green-900 dark:text-green-100 flex gap-2">
                          <span className="text-green-600 dark:text-green-400 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sheetContent.type === 'counter' && sheetContent.option.counter_arguments && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <span className="font-medium text-amber-900 dark:text-amber-100">Counter-Arguments</span>
                    </div>
                    <ul className="space-y-2">
                      {sheetContent.option.counter_arguments.map((point, i) => (
                        <li key={i} className="text-sm text-amber-900 dark:text-amber-100 flex gap-2">
                          <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Prefetch indicator */}
      {isPrefetching && (
        <div className="fixed bottom-6 right-6 bg-muted rounded-full px-4 py-2 text-sm shadow-lg flex items-center gap-2 z-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Preparing alternatives</span>
        </div>
      )}
    </AppLayout>
  );
}
