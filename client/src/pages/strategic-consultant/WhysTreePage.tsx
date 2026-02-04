import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

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

interface UnderstandingResponse {
  id: string;
  sessionId: string;
  userInput: string;
  journeyType?: string;
}

interface GraphNodeData {
  label: string;
  option?: string;
  questionAsked?: string;
  nextQuestion?: string;
  depth: number;
  isRoot?: boolean;
  isLoading?: boolean;
  isSelected?: boolean;
  isActivePath?: boolean;
  supporting_evidence?: string[];
  counter_arguments?: string[];
  consideration?: string;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 120;
const RADIAL_DISTANCE = 260;
const CHILD_SPREAD = Math.PI * 0.9; // ~162 degrees

const nodeTypes: NodeTypes = {
  whyNode: WhyGraphNode,
};

function WhyGraphNode({ data }: { data: GraphNodeData }) {
  if (data.isLoading) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <div className="space-y-2 w-full">
            <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
            <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "transition-shadow",
        data.isSelected ? "border-primary shadow-lg" : "border-border",
        data.isActivePath && !data.isSelected ? "border-primary/50" : ""
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm leading-snug">{data.label}</CardTitle>
          <Badge variant="outline" className="text-[10px]">
            L{data.depth}
          </Badge>
        </div>
      </CardHeader>
      {data.option && (
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {data.option}
        </CardContent>
      )}
    </Card>
  );
}

export default function WhysTreePage() {
  const [, params] = useRoute("/strategic-consultant/whys-tree/:understandingId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const understandingId = params?.understandingId;

  const [understanding, setUnderstanding] = useState<UnderstandingResponse | null>(null);
  const [journeySessionId, setJourneySessionId] = useState<string | null>(null);
  const [isLoadingUnderstanding, setIsLoadingUnderstanding] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [treeMeta, setTreeMeta] = useState<{ rootQuestion: string; maxDepth: number } | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [customWhyText, setCustomWhyText] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  const nodeMetaRef = useRef(new Map<string, { parentId?: string; depth: number; angle: number; questionAsked?: string }>());

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const pathIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const ids = new Set<string>();
    let current = selectedNodeId;
    while (current) {
      ids.add(current);
      const meta = nodeMetaRef.current.get(current);
      current = meta?.parentId || "";
      if (!current) break;
    }
    return ids;
  }, [selectedNodeId, nodes.length]);

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
          throw new Error("Failed to fetch understanding");
        }
        const data = (await response.json()) as UnderstandingResponse;

        const storedJourneySessionId = localStorage.getItem(`current-journey-session-${data.id}`);
        if (storedJourneySessionId) {
          try {
            const journeyResponse = await fetch(`/api/strategic-consultant/journey-sessions/${storedJourneySessionId}`);
            if (journeyResponse.ok) {
              const journeyData = await journeyResponse.json();
              if (journeyData.journeyType) {
                localStorage.setItem(`journey-type-${data.sessionId}`, journeyData.journeyType);
                data.journeyType = journeyData.journeyType;
              }
              setJourneySessionId(storedJourneySessionId);
            }
          } catch (journeyError) {
            console.warn("Could not fetch journey session:", journeyError);
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
    const generateTree = async () => {
      if (!understanding) return;
      setIsGenerating(true);
      try {
        const response = await apiRequest("POST", "/api/strategic-consultant/whys-tree/generate", {
          sessionId: understanding.sessionId,
          input: understanding.userInput,
        });
        const data = (await response.json()) as { tree: WhyTree };
        initializeGraph(data.tree);
      } catch (error: any) {
        toast({
          title: "Tree generation failed",
          description: error.message || "Failed to generate decision tree",
          variant: "destructive",
        });
      } finally {
        setIsGenerating(false);
      }
    };

    if (understanding) {
      generateTree();
    }
  }, [understanding]);

  const initializeGraph = (tree: WhyTree) => {
    setTreeMeta({ rootQuestion: tree.rootQuestion, maxDepth: tree.maxDepth });
    nodeMetaRef.current.clear();

    const rootId = "root";
    const rootNode: Node<GraphNodeData> = {
      id: rootId,
      type: "whyNode",
      position: { x: 0, y: 0 },
      data: {
        label: tree.rootQuestion,
        depth: 1,
        isRoot: true,
      },
      style: { width: NODE_WIDTH },
    };

    nodeMetaRef.current.set(rootId, { depth: 1, angle: 0, questionAsked: tree.rootQuestion });

    const childNodes = createChildNodes(rootNode, tree.branches, tree.rootQuestion);
    const childEdges = childNodes.map((node) => ({
      id: `e-${rootId}-${node.id}`,
      source: rootId,
      target: node.id,
      type: "smoothstep" as const,
    }));

    setNodes([rootNode, ...childNodes]);
    setEdges(childEdges);
    setSelectedNodeId(rootId);
  };

  const createChildNodes = (parent: Node<GraphNodeData>, branches: WhyNode[], questionAsked: string) => {
    const parentMeta = nodeMetaRef.current.get(parent.id);
    const parentAngle = parentMeta?.angle ?? 0;
    const offsets = [-CHILD_SPREAD / 2, 0, CHILD_SPREAD / 2];
    const baseAngles = branches.length === 1 ? [parentAngle] : offsets.map((o) => parentAngle + o);

    return branches.map((branch, index) => {
      const angle = baseAngles[index % baseAngles.length];
      const position = {
        x: parent.position.x + RADIAL_DISTANCE * Math.cos(angle),
        y: parent.position.y + RADIAL_DISTANCE * Math.sin(angle),
      };

      nodeMetaRef.current.set(branch.id, {
        parentId: parent.id,
        depth: branch.depth,
        angle,
        questionAsked,
      });

      return {
        id: branch.id,
        type: "whyNode",
        position,
        data: {
          label: branch.option,
          option: branch.consideration,
          questionAsked,
          nextQuestion: branch.question,
          depth: branch.depth,
          supporting_evidence: branch.supporting_evidence,
          counter_arguments: branch.counter_arguments,
          consideration: branch.consideration,
        },
        style: { width: NODE_WIDTH },
      } as Node<GraphNodeData>;
    });
  };

  const centerOnNode = (nodeId: string) => {
    if (!reactFlowInstance) return;
    const node = reactFlowInstance.getNode(nodeId);
    if (!node) return;
    const centerX = node.position.x + NODE_WIDTH / 2;
    const centerY = node.position.y + NODE_HEIGHT / 2;
    reactFlowInstance.setCenter(centerX, centerY, { zoom: 1, duration: 600 });
  };

  const updateSelectionVisuals = (nodeId: string | null) => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isSelected: node.id === nodeId,
          isActivePath: nodeId ? pathIds.has(node.id) : false,
        },
      }))
    );

    setEdges((eds) =>
      eds.map((edge) => {
        const isActive = nodeId ? pathIds.has(edge.source) && pathIds.has(edge.target) : false;
        return {
          ...edge,
          animated: isActive,
          style: {
            stroke: isActive ? "hsl(var(--primary))" : "hsl(var(--border))",
            strokeWidth: isActive ? 2 : 1,
          },
        };
      })
    );
  };

  useEffect(() => {
    updateSelectionVisuals(selectedNodeId);
  }, [selectedNodeId, nodes.length, edges.length]);

  const buildSelectedPath = (nodeId: string): Array<{ question: string; answer: string }> => {
    const path: Array<{ question: string; answer: string }> = [];
    let currentId: string | undefined = nodeId;
    while (currentId) {
      const meta = nodeMetaRef.current.get(currentId);
      const node = nodes.find((n) => n.id === currentId);
      if (node && meta?.questionAsked && node.data?.label && !node.data.isRoot) {
        path.push({ question: meta.questionAsked, answer: node.data.label });
      }
      currentId = meta?.parentId;
    }
    return path.reverse();
  };

  const hasChildrenLoaded = (nodeId: string) => {
    return edges.some((edge) => edge.source === nodeId && !edge.target.startsWith("loading-"));
  };

  const removeLoadingChildren = (parentId: string) => {
    setNodes((nds) => nds.filter((node) => !(node.id.startsWith("loading-") && nodeMetaRef.current.get(node.id)?.parentId === parentId)));
    setEdges((eds) => eds.filter((edge) => !(edge.source === parentId && edge.target.startsWith("loading-"))));
  };

  const expandNode = async (nodeId: string) => {
    if (!understanding || isProcessingAction) return;
    if (hasChildrenLoaded(nodeId)) return;

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const meta = nodeMetaRef.current.get(nodeId);
    if (!meta || !treeMeta || meta.depth >= treeMeta.maxDepth) return;

    setIsProcessingAction(true);

    const loadingId = `loading-${nodeId}`;
    const angle = meta.angle;
    const position = {
      x: node.position.x + RADIAL_DISTANCE * Math.cos(angle),
      y: node.position.y + RADIAL_DISTANCE * Math.sin(angle),
    };

    nodeMetaRef.current.set(loadingId, {
      parentId: nodeId,
      depth: meta.depth + 1,
      angle,
    });

    setNodes((nds) => [
      ...nds,
      {
        id: loadingId,
        type: "whyNode",
        position,
        data: {
          label: "Loading next why...",
          depth: meta.depth + 1,
          isLoading: true,
        },
        style: { width: NODE_WIDTH },
      },
    ]);

    setEdges((eds) => [
      ...eds,
      {
        id: `e-${nodeId}-${loadingId}`,
        source: nodeId,
        target: loadingId,
        type: "smoothstep",
      },
    ]);

    try {
      const response = await apiRequest("POST", "/api/strategic-consultant/whys-tree/expand", {
        sessionId: understanding.sessionId,
        nodeId,
        selectedPath: buildSelectedPath(nodeId),
        currentDepth: meta.depth,
        parentQuestion: node.data?.nextQuestion || node.data?.questionAsked || node.data?.label,
        input: understanding.userInput,
      });

      const data = (await response.json()) as { expandedBranches: WhyNode[] };
      removeLoadingChildren(nodeId);

      if (!data.expandedBranches || data.expandedBranches.length === 0) {
        setIsProcessingAction(false);
        return;
      }

      const childNodes = createChildNodes(
        node,
        data.expandedBranches,
        node.data?.nextQuestion || node.data?.label || ""
      );
      const childEdges = childNodes.map((child) => ({
        id: `e-${nodeId}-${child.id}`,
        source: nodeId,
        target: child.id,
        type: "smoothstep" as const,
      }));

      setNodes((nds) => [...nds, ...childNodes]);
      setEdges((eds) => [...eds, ...childEdges]);
    } catch (error: any) {
      removeLoadingChildren(nodeId);
      toast({
        title: "Expansion failed",
        description: error.message || "Failed to expand branch",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleNodeClick = (_: any, node: Node<GraphNodeData>) => {
    setSelectedNodeId(node.id);
    centerOnNode(node.id);
    if (!node.data?.isRoot) {
      expandNode(node.id);
    }
  };

  const handleFinalize = async () => {
    if (!selectedNodeId || !understanding) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node || node.data?.isRoot) return;

    try {
      setValidationWarning(null);
      const response = await apiRequest("POST", "/api/strategic-consultant/whys-tree/validate-root-cause", {
        rootCauseText: node.data?.label,
      });
      const validation = await response.json();
      if (!validation.valid) {
        setValidationWarning(validation.message || "This root cause needs refinement.");
        return;
      }

      const sessionIdForNavigation = journeySessionId || understanding.sessionId;
      const pathHistory = buildSelectedPath(selectedNodeId);
      const finalizeResponse = await apiRequest("POST", "/api/strategic-consultant/whys-tree/finalize", {
        sessionId: understanding.sessionId,
        selectedPath: pathHistory,
        rootCause: node.data?.label,
        input: understanding.userInput,
      });

      await finalizeResponse.json();

      localStorage.setItem(`strategic-rootCause-${sessionIdForNavigation}`, node.data?.label || "");
      localStorage.setItem(`strategic-whysPath-${sessionIdForNavigation}`, JSON.stringify(pathHistory));
      localStorage.setItem(`strategic-input-${sessionIdForNavigation}`, understanding.userInput);
      localStorage.setItem(`journey-type-${sessionIdForNavigation}`, understanding.journeyType || "");

      toast({
        title: "Root cause identified",
        description: "Proceeding to research phase",
      });
      setLocation(`/strategic-consultant/research/${sessionIdForNavigation}`);
    } catch (error: any) {
      toast({
        title: "Finalization failed",
        description: error.message || "Failed to finalize root cause",
        variant: "destructive",
      });
    }
  };

  const handleAddCustomWhy = () => {
    if (!customWhyText.trim() || !selectedNodeId || !treeMeta) return;
    const parentNode = nodes.find((n) => n.id === selectedNodeId);
    if (!parentNode) return;

    const customId = `custom-${Date.now()}`;
    const parentMeta = nodeMetaRef.current.get(selectedNodeId);
    if (!parentMeta) return;

    const angle = parentMeta.angle + Math.PI / 4;
    const position = {
      x: parentNode.position.x + RADIAL_DISTANCE * Math.cos(angle),
      y: parentNode.position.y + RADIAL_DISTANCE * Math.sin(angle),
    };

    nodeMetaRef.current.set(customId, {
      parentId: selectedNodeId,
      depth: parentMeta.depth + 1,
      angle,
      questionAsked: parentNode.data?.label || parentNode.data?.questionAsked,
    });

    setNodes((nds) => [
      ...nds,
      {
        id: customId,
        type: "whyNode",
        position,
        data: {
          label: customWhyText.trim(),
          depth: parentMeta.depth + 1,
          questionAsked: parentNode.data?.label || parentNode.data?.questionAsked,
          nextQuestion: `Why is this? (${customWhyText.trim()})`,
          supporting_evidence: [],
          counter_arguments: [],
          consideration: "Custom option",
        },
        style: { width: NODE_WIDTH },
      },
    ]);

    setEdges((eds) => [
      ...eds,
      {
        id: `e-${selectedNodeId}-${customId}`,
        source: selectedNodeId,
        target: customId,
        type: "smoothstep",
      },
    ]);

    setCustomWhyText("");
  };

  if (isLoadingUnderstanding || isGenerating) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[70vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            fitView
            minZoom={0.2}
            maxZoom={2}
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls />
          </ReactFlow>
        </div>

        <aside className="w-96 border-l border-border bg-background/80 backdrop-blur p-4 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Badge variant="secondary">Five Whys</Badge>
            <h2 className="text-lg font-semibold">Path Navigator</h2>
            <p className="text-sm text-muted-foreground">
              Click any node to focus. The camera will center on it and expand its next level.
            </p>
          </div>

          {validationWarning && (
            <Alert variant="destructive">
              <AlertTitle>Validation Warning</AlertTitle>
              <AlertDescription>{validationWarning}</AlertDescription>
            </Alert>
          )}

          {selectedNode ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selected Why</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Statement</div>
                  <div className="font-medium">{selectedNode.data.label}</div>
                </div>
                {selectedNode.data.consideration && (
                  <div>
                    <div className="text-xs text-muted-foreground">Consideration</div>
                    <div>{selectedNode.data.consideration}</div>
                  </div>
                )}
                {selectedNode.data.supporting_evidence && selectedNode.data.supporting_evidence.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Evidence</div>
                    <ul className="list-disc ml-4 space-y-1">
                      {selectedNode.data.supporting_evidence.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedNode.data.counter_arguments && selectedNode.data.counter_arguments.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Counterpoints</div>
                    <ul className="list-disc ml-4 space-y-1">
                      {selectedNode.data.counter_arguments.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!selectedNode.data.isRoot && (
                  <div className="pt-2 space-y-2">
                    <Button className="w-full" onClick={handleFinalize}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      This is my root cause
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Select a node in the graph to see details and actions.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add a Custom Why</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={customWhyText}
                onChange={(e) => setCustomWhyText(e.target.value)}
                placeholder="Add your own why statement here..."
              />
              <Button variant="secondary" className="w-full" onClick={handleAddCustomWhy} disabled={!selectedNodeId}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Add as child of selected node
              </Button>
            </CardContent>
          </Card>

          {isProcessingAction && (
            <Alert>
              <AlertTitle>Generating next why...</AlertTitle>
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing new branch options.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {treeMeta && (
            <div className="text-xs text-muted-foreground">Depth target: {treeMeta.maxDepth} levels</div>
          )}
        </aside>
      </div>
    </AppLayout>
  );
}
