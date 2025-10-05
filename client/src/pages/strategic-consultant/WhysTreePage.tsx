import { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, ChevronRight } from "lucide-react";
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

const CustomNode = ({ data }: { data: any }) => {
  const isSelected = data.isSelected;
  const isInPath = data.isInPath;
  const isExpandable = data.isExpandable;
  const isRootCauseCandidate = data.isRootCauseCandidate;

  return (
    <Card
      className={`min-w-[250px] max-w-[300px] transition-all cursor-pointer ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-lg'
          : isInPath
          ? 'border-blue-300 bg-blue-25 dark:bg-blue-900/30'
          : 'border-gray-300 bg-white dark:bg-gray-800 opacity-60'
      }`}
      onClick={data.onClick}
      data-testid={`node-${data.id}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{data.label}</p>
          {isSelected && (
            <Badge variant="default" className="text-xs shrink-0">Selected</Badge>
          )}
        </div>
        
        {data.question && (
          <p className="text-xs text-muted-foreground italic">{data.question}</p>
        )}

        {isExpandable && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              data.onExpand();
            }}
            data-testid={`button-expand-${data.id}`}
          >
            Expand Branch
          </Button>
        )}

        {isRootCauseCandidate && (
          <Button
            size="sm"
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              data.onFinalize();
            }}
            data-testid={`button-finalize-${data.id}`}
          >
            This is my root cause
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function WhysTreePage() {
  const [, params] = useRoute("/strategic-consultant/whys-tree/:sessionId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId;

  const [tree, setTree] = useState<WhyTree | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const generateTreeMutation = useMutation({
    mutationFn: async () => {
      const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';
      return apiRequest('POST', '/api/strategic-consultant/whys-tree/generate', {
        sessionId,
        input,
      });
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
      return apiRequest('POST', '/api/strategic-consultant/whys-tree/expand', {
        sessionId,
        nodeId,
        selectedPath,
        currentDepth,
        parentQuestion,
        input,
      });
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
        setExpandedNodes(prev => [...prev, variables.nodeId]);
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
    mutationFn: async (rootCause: string) => {
      const input = localStorage.getItem(`strategic-input-${sessionId}`) || '';
      return apiRequest('POST', '/api/strategic-consultant/whys-tree/finalize', {
        sessionId,
        selectedPath,
        rootCause,
        input,
      });
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

  const handleNodeClick = useCallback((nodeId: string) => {
    if (selectedPath.includes(nodeId)) return;
    
    setSelectedPath(prev => {
      const node = findNodeById(tree, nodeId);
      if (!node) return prev;
      
      const pathToNode: string[] = [];
      let currentNode = node;
      
      while (currentNode) {
        pathToNode.unshift(currentNode.id);
        if (!currentNode.parentId) break;
        currentNode = findNodeById(tree, currentNode.parentId)!;
      }
      
      return pathToNode;
    });
  }, [tree]);

  const handleExpand = useCallback((nodeId: string) => {
    const node = findNodeById(tree, nodeId);
    if (!node) return;

    expandBranchMutation.mutate({
      nodeId,
      parentQuestion: node.question,
      currentDepth: node.depth,
    });
  }, [tree]);

  const handleFinalize = useCallback((nodeId: string) => {
    const node = findNodeById(tree, nodeId);
    if (!node) return;

    finalizeMutation.mutate(node.option);
  }, [tree, selectedPath]);

  const handleBack = useCallback(() => {
    setSelectedPath(prev => prev.slice(0, -1));
  }, []);

  useEffect(() => {
    if (!tree) return;

    const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(
      tree,
      selectedPath,
      expandedNodes,
      handleNodeClick,
      handleExpand,
      handleFinalize
    );

    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [tree, selectedPath, expandedNodes]);

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
          <p className="text-muted-foreground">Building decision tree...</p>
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

  const selectedNode = selectedPath.length > 0 
    ? findNodeById(tree, selectedPath[selectedPath.length - 1])
    : null;

  const breadcrumbPath = selectedPath
    .map(id => findNodeById(tree, id))
    .filter(Boolean)
    .map(node => node!.option);

  return (
    <AppLayout
      title="Why's Tree Analysis"
      subtitle="Explore root causes through interactive decision tree"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="space-y-4 h-[calc(100vh-12rem)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedPath.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <p className="text-sm font-medium" data-testid="text-root-question">
              {tree.rootQuestion}
            </p>
          </div>
          {expandBranchMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Expanding branch...
            </div>
          )}
        </div>

        {breadcrumbPath.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap" data-testid="breadcrumb-path">
            <span className="text-sm text-muted-foreground">Selected path:</span>
            {breadcrumbPath.map((text, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Badge variant="outline">{text}</Badge>
                {idx < breadcrumbPath.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border rounded-lg bg-background h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={1.5}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      </div>
    </AppLayout>
  );
}

function findNodeById(tree: WhyTree | null, nodeId: string): WhyNode | null {
  if (!tree) return null;

  const search = (nodes: WhyNode[]): WhyNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if (node.branches) {
        const found = search(node.branches);
        if (found) return found;
      }
    }
    return null;
  };

  return search(tree.branches);
}

function layoutTree(
  tree: WhyTree,
  selectedPath: string[],
  expandedNodes: string[],
  onNodeClick: (id: string) => void,
  onExpand: (id: string) => void,
  onFinalize: (id: string) => void
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const horizontalSpacing = 400;
  const verticalSpacing = 150;

  const traverse = (
    whyNodes: WhyNode[],
    depth: number,
    parentId?: string,
    startX: number = 0,
    parentX?: number
  ) => {
    const nodeCount = whyNodes.length;
    const totalWidth = nodeCount * horizontalSpacing;
    const startXPos = startX - totalWidth / 2;

    whyNodes.forEach((whyNode, index) => {
      const x = startXPos + index * horizontalSpacing + horizontalSpacing / 2;
      const y = depth * verticalSpacing;

      const isSelected = selectedPath[selectedPath.length - 1] === whyNode.id;
      const isInPath = selectedPath.includes(whyNode.id);
      const isExpandable = isSelected && whyNode.depth === 2 && !expandedNodes.includes(whyNode.id);
      const isRootCauseCandidate = isSelected && whyNode.depth >= 3;

      nodes.push({
        id: whyNode.id,
        type: 'custom',
        position: { x, y },
        data: {
          id: whyNode.id,
          label: whyNode.option,
          question: whyNode.question,
          isSelected,
          isInPath,
          isExpandable,
          isRootCauseCandidate,
          onClick: () => onNodeClick(whyNode.id),
          onExpand: () => onExpand(whyNode.id),
          onFinalize: () => onFinalize(whyNode.id),
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      if (parentId) {
        edges.push({
          id: `${parentId}-${whyNode.id}`,
          source: parentId,
          target: whyNode.id,
          style: {
            stroke: isInPath ? '#3b82f6' : '#d1d5db',
            strokeWidth: isInPath ? 3 : 2,
          },
          animated: isInPath,
        });
      }

      if (whyNode.branches && whyNode.branches.length > 0) {
        traverse(whyNode.branches, depth + 1, whyNode.id, x, x);
      }
    });
  };

  traverse(tree.branches, 0);

  return { nodes, edges };
}
