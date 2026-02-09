import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
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
  summary?: string;
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
  summary?: string;
  option?: string;
  questionAsked?: string;
  nextQuestion?: string;
  depth: number;
  isRoot?: boolean;
  isLoading?: boolean;
  supporting_evidence?: string[];
  counter_arguments?: string[];
  consideration?: string;
}

const NODE_W = 220;
const NODE_H = 110;
const H_GAP = 40;
const V_GAP = 140;
const MAX_CHILDREN = 3;
const NODE_SUMMARY_LIMIT = 220;

const slotKey = (d: number, i: number) => `${d}-${i}`;

function computeLayout(activeSlots: Set<string>) {
  const nodes: Record<string, { d: number; i: number; x: number; y: number; key: string }> = {};
  const edges: Array<{ key: string; parent: string; child: string }> = [];

  const parsed = Array.from(activeSlots).map((key) => {
    const [d, i] = key.split("-").map((v) => parseInt(v, 10));
    return { d, i, key };
  });
  parsed.sort((a, b) => a.d - b.d || a.i - b.i);

  const childrenOf: Record<string, Array<{ d: number; i: number; key: string }>> = {};
  parsed.forEach((n) => {
    const ck = slotKey(n.d, n.i);
    childrenOf[ck] = [];
    if (n.d < 5) {
      for (let c = 0; c < MAX_CHILDREN; c++) {
        const ci = n.i * MAX_CHILDREN + c;
        const childKey = slotKey(n.d + 1, ci);
        if (activeSlots.has(childKey)) {
          childrenOf[ck].push({ d: n.d + 1, i: ci, key: childKey });
        }
      }
    }
  });

  const widthOf: Record<string, number> = {};
  const computeWidth = (d: number, i: number) => {
    const key = slotKey(d, i);
    const children = childrenOf[key] || [];
    if (children.length === 0) {
      widthOf[key] = NODE_W + H_GAP;
      return widthOf[key];
    }
    let total = 0;
    children.forEach((ch) => {
      total += computeWidth(ch.d, ch.i);
    });
    widthOf[key] = Math.max(NODE_W + H_GAP, total);
    return widthOf[key];
  };

  if (activeSlots.has("0-0")) {
    computeWidth(0, 0);
  }

  const assignX = (d: number, i: number, leftEdge: number) => {
    const key = slotKey(d, i);
    const myWidth = widthOf[key] ?? NODE_W + H_GAP;
    const centerX = leftEdge + myWidth / 2;
    const y = d * (NODE_H + V_GAP);
    nodes[key] = { d, i, x: centerX, y, key };

    const children = childrenOf[key] || [];
    if (children.length > 0) {
      let childLeft = leftEdge;
      children.forEach((ch) => {
        const cw = widthOf[slotKey(ch.d, ch.i)] ?? NODE_W + H_GAP;
        assignX(ch.d, ch.i, childLeft);
        childLeft += cw;
      });
    }
  };

  if (activeSlots.has("0-0")) {
    const rootWidth = widthOf["0-0"] ?? NODE_W + H_GAP;
    assignX(0, 0, -rootWidth / 2);
  }

  parsed.forEach((n) => {
    if (n.d > 0) {
      const pi = Math.floor(n.i / MAX_CHILDREN);
      const parentKey = slotKey(n.d - 1, pi);
      if (nodes[parentKey] && nodes[n.key]) {
        edges.push({ key: `e-${parentKey}-${n.key}`, parent: parentKey, child: n.key });
      }
    }
  });

  return { nodes: Object.values(nodes), edges };
}

function computeBounds(nodes: Array<{ x: number; y: number }>) {
  if (nodes.length === 0) return { x: -200, y: -50, w: 400, h: 200 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    if (n.x - NODE_W / 2 < minX) minX = n.x - NODE_W / 2;
    if (n.x + NODE_W / 2 > maxX) maxX = n.x + NODE_W / 2;
    if (n.y < minY) minY = n.y;
    if (n.y + NODE_H + 30 > maxY) maxY = n.y + NODE_H + 30;
  });
  const px = 120;
  const py = 100;
  return { x: minX - px, y: minY - py, w: maxX - minX + px * 2, h: maxY - minY + py * 2 };
}

function summarizeText(text?: string, limit: number = NODE_SUMMARY_LIMIT) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return trimmed.slice(0, limit - 1).trimEnd() + "…";
}

function summarizeStatement(text?: string) {
  if (!text) return "";
  let t = text.replace(/→/g, " ").replace(/\s+/g, " ").trim();
  // Prefer the first sentence
  const sentence = t.split(/[.!?]/)[0]?.trim() || t;
  t = sentence;

  const cutTokens = [" through ", " where ", " while ", " which ", " that ", " because ", " due to "];
  for (const token of cutTokens) {
    const idx = t.toLowerCase().indexOf(token);
    if (idx > 40) {
      t = t.slice(0, idx).trim();
      break;
    }
  }

  // Limit to ~16 words for compact summary
  const words = t.split(" ");
  if (words.length > 16) {
    t = words.slice(0, 16).join(" ");
  }

  return summarizeText(t, NODE_SUMMARY_LIMIT);
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

  const [activeSlots, setActiveSlots] = useState<Set<string>>(new Set(["0-0"]));
  const [slotToNodeId, setSlotToNodeId] = useState<Record<string, string>>({});
  const [nodeDataById, setNodeDataById] = useState<Record<string, GraphNodeData>>({});
  const nodeMetaRef = useRef(new Map<string, { parentId?: string; depth: number; index: number; questionAsked?: string }>());

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [confirmedPathIds, setConfirmedPathIds] = useState<string[]>([]);
  const [customWhyText, setCustomWhyText] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const vbRef = useRef({ x: -200, y: -50, w: 400, h: 200 });
  const [viewBox, setViewBox] = useState(vbRef.current);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  const confirmedSet = useMemo(() => new Set(confirmedPathIds), [confirmedPathIds]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodeDataById[selectedNodeId] || null;
  }, [nodeDataById, selectedNodeId]);

  const selectedMeta = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodeMetaRef.current.get(selectedNodeId) || null;
  }, [selectedNodeId]);

  const selectedDepth = selectedMeta?.depth ?? 0;
  const isSelectedConfirmed = selectedNodeId ? confirmedSet.has(selectedNodeId) : false;
  const canFinalizeRootCause = Boolean(
    selectedNodeId &&
      selectedNode &&
      !selectedNode.isRoot &&
      selectedDepth >= 4
  );

  const canConfirmWhy = Boolean(
    selectedNodeId &&
      selectedNode &&
      !selectedNode.isRoot &&
      selectedDepth < 4
  );

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
              if (journeyData.versionNumber) {
                localStorage.setItem(`journey-version-${data.sessionId}`, String(journeyData.versionNumber));
                localStorage.setItem(`journey-version-${storedJourneySessionId}`, String(journeyData.versionNumber));
                localStorage.setItem(`strategic-versionNumber-${data.sessionId}`, String(journeyData.versionNumber));
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
    setConfirmedPathIds([]);

    const rootId = "root";
    const rootSlot = slotKey(0, 0);

    nodeMetaRef.current.set(rootId, { depth: 0, index: 0, questionAsked: tree.rootQuestion });

    const rootData: GraphNodeData = {
      label: tree.rootQuestion,
      depth: 1,
      isRoot: true,
    };

    const newNodeData: Record<string, GraphNodeData> = { [rootId]: rootData };
    const newSlotToId: Record<string, string> = { [rootSlot]: rootId };

    const newActive = new Set<string>([rootSlot]);

    tree.branches.forEach((branch, idx) => {
      const childSlot = slotKey(1, idx);
      nodeMetaRef.current.set(branch.id, {
        parentId: rootId,
        depth: 1,
        index: idx,
        questionAsked: tree.rootQuestion,
      });
      newSlotToId[childSlot] = branch.id;
      newNodeData[branch.id] = {
        label: branch.option,
        summary: branch.summary,
        option: branch.consideration,
        questionAsked: tree.rootQuestion,
        nextQuestion: branch.question,
        depth: 2,
        supporting_evidence: branch.supporting_evidence,
        counter_arguments: branch.counter_arguments,
        consideration: branch.consideration,
      };
      newActive.add(childSlot);
    });

    setSlotToNodeId(newSlotToId);
    setNodeDataById(newNodeData);
    setActiveSlots(newActive);
    setSelectedNodeId(rootId);
  };

  const layout = useMemo(() => computeLayout(activeSlots), [activeSlots]);

  const posBySlot = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    layout.nodes.forEach((n) => {
      map[n.key] = { x: n.x, y: n.y };
    });
    return map;
  }, [layout.nodes]);

  useEffect(() => {
    const b = computeBounds(layout.nodes);
    vbRef.current = b;
    setViewBox(b);
  }, [layout]);

  const centerOnNodeId = useCallback((nodeId: string) => {
    const meta = nodeMetaRef.current.get(nodeId);
    if (!meta) return;
    const key = slotKey(meta.depth, meta.index);
    const pos = posBySlot[key];
    if (!pos) return;
    const vb = vbRef.current;
    const cx = pos.x;
    const cy = pos.y;
    const nb = { x: cx - vb.w / 2, y: cy - vb.h / 2, w: vb.w, h: vb.h };
    vbRef.current = nb;
    setViewBox(nb);
  }, [posBySlot]);

  const buildSelectedPath = (nodeId: string): Array<{ question: string; answer: string }> => {
    const path: Array<{ question: string; answer: string }> = [];
    let currentId: string | undefined = nodeId;
    while (currentId) {
      const meta = nodeMetaRef.current.get(currentId);
      const node = nodeDataById[currentId];
      if (node && node.label && !node.isRoot) {
        const fallbackQuestion = meta?.depth ? `Why ${meta.depth}?` : "Why?";
        path.push({ question: meta?.questionAsked || fallbackQuestion, answer: node.label });
      }
      currentId = meta?.parentId;
    }
    return path.reverse();
  };

  const expandNode = async (nodeId: string) => {
    if (!understanding || isProcessingAction) return;
    const meta = nodeMetaRef.current.get(nodeId);
    if (!meta || !treeMeta || meta.depth >= treeMeta.maxDepth - 1) return;

    setIsProcessingAction(true);

    const childSlots = [0, 1, 2].map((c) => slotKey(meta.depth + 1, meta.index * MAX_CHILDREN + c));
    const newActive = new Set(activeSlots);
    const newSlotToId = { ...slotToNodeId };
    const newNodeData = { ...nodeDataById };

    childSlots.forEach((slot, idx) => {
      if (!newSlotToId[slot]) {
        const tempId = `temp-${slot}`;
        newSlotToId[slot] = tempId;
        newNodeData[tempId] = {
          label: "Loading...",
          depth: meta.depth + 2,
          isLoading: true,
        };
      }
      newActive.add(slot);
    });

    setActiveSlots(newActive);
    setSlotToNodeId(newSlotToId);
    setNodeDataById(newNodeData);

    try {
      const response = await apiRequest("POST", "/api/strategic-consultant/whys-tree/expand", {
        sessionId: understanding.sessionId,
        nodeId,
        selectedPath: buildSelectedPath(nodeId),
        currentDepth: meta.depth + 1,
        parentQuestion: nodeDataById[nodeId]?.nextQuestion || nodeDataById[nodeId]?.label,
        input: understanding.userInput,
      });

      const data = (await response.json()) as { expandedBranches: WhyNode[] };
      if (!data.expandedBranches || data.expandedBranches.length === 0) {
        setIsProcessingAction(false);
        return;
      }

      const updatedSlotToId = { ...newSlotToId };
      const updatedNodeData = { ...newNodeData };

      data.expandedBranches.forEach((branch, idx) => {
        const slot = childSlots[idx] || childSlots[0];
        const oldId = updatedSlotToId[slot];
        if (oldId && oldId.startsWith("temp-")) {
          delete updatedNodeData[oldId];
        }
        updatedSlotToId[slot] = branch.id;
        updatedNodeData[branch.id] = {
          label: branch.option,
          summary: branch.summary,
          option: branch.consideration,
          questionAsked: nodeDataById[nodeId]?.nextQuestion || nodeDataById[nodeId]?.label,
          nextQuestion: branch.question,
          depth: meta.depth + 2,
          supporting_evidence: branch.supporting_evidence,
          counter_arguments: branch.counter_arguments,
          consideration: branch.consideration,
        };
        nodeMetaRef.current.set(branch.id, {
          parentId: nodeId,
          depth: meta.depth + 1,
          index: meta.index * MAX_CHILDREN + idx,
          questionAsked: nodeDataById[nodeId]?.nextQuestion || nodeDataById[nodeId]?.label,
        });
      });

      setSlotToNodeId(updatedSlotToId);
      setNodeDataById(updatedNodeData);

      // Prefetch siblings in background (non-blocking)
      prefetchSiblingBranches(nodeId, meta.depth + 1, updatedSlotToId, updatedNodeData, newActive);
    } catch (error: any) {
      toast({
        title: "Expansion failed",
        description: error.message || "Failed to expand branch",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const prefetchSiblingBranches = async (
    parentId: string,
    depth: number,
    currentSlotToId: Record<string, string>,
    currentNodeData: Record<string, GraphNodeData>,
    currentActive: Set<string>
  ) => {
    if (!understanding) return;
    if (!treeMeta || depth >= treeMeta.maxDepth) return;

    const parentMeta = nodeMetaRef.current.get(parentId);
    if (!parentMeta) return;

    const siblingGroupIndex = Math.floor(parentMeta.index / MAX_CHILDREN);
    const siblings = [0, 1, 2].map((c) => siblingGroupIndex * MAX_CHILDREN + c);

    for (const siblingIndex of siblings) {
      const siblingSlot = slotKey(depth, siblingIndex);
      const siblingId = currentSlotToId[siblingSlot];
      if (!siblingId || siblingId === parentId) continue;
      // Skip if already expanded
      const hasAnyChild = [0, 1, 2].some((c) => currentSlotToId[slotKey(depth + 1, siblingIndex * MAX_CHILDREN + c)]);
      if (hasAnyChild) continue;

      try {
        const response = await apiRequest("POST", "/api/strategic-consultant/whys-tree/expand", {
          sessionId: understanding.sessionId,
          nodeId: siblingId,
          selectedPath: buildSelectedPath(siblingId),
          currentDepth: depth,
          parentQuestion: currentNodeData[siblingId]?.nextQuestion || currentNodeData[siblingId]?.label,
          input: understanding.userInput,
        });

        const data = (await response.json()) as { expandedBranches: WhyNode[] };
        if (!data.expandedBranches || data.expandedBranches.length === 0) continue;

        const nextSlotToId = { ...currentSlotToId };
        const nextNodeData = { ...currentNodeData };
        const nextActive = new Set(currentActive);

        data.expandedBranches.forEach((branch, idx) => {
          const childSlot = slotKey(depth + 1, siblingIndex * MAX_CHILDREN + idx);
          nextSlotToId[childSlot] = branch.id;
          nextNodeData[branch.id] = {
            label: branch.option,
            option: branch.consideration,
            questionAsked: currentNodeData[siblingId]?.nextQuestion || currentNodeData[siblingId]?.label,
            nextQuestion: branch.question,
            depth: depth + 2,
            supporting_evidence: branch.supporting_evidence,
            counter_arguments: branch.counter_arguments,
            consideration: branch.consideration,
          };
          nodeMetaRef.current.set(branch.id, {
            parentId: siblingId,
            depth: depth + 1,
            index: siblingIndex * MAX_CHILDREN + idx,
            questionAsked: currentNodeData[siblingId]?.nextQuestion || currentNodeData[siblingId]?.label,
          });
          nextActive.add(childSlot);
        });

        setSlotToNodeId(nextSlotToId);
        setNodeDataById(nextNodeData);
        setActiveSlots(nextActive);
      } catch (error) {
        // Prefetch failures are non-fatal
      }
    }
  };

  const handleConfirmWhy = () => {
    if (!selectedNode || selectedNode.isRoot) return;
    if (!selectedNodeId) return;
    setConfirmedPathIds((prev) => (prev.includes(selectedNodeId) ? prev : [...prev, selectedNodeId]));
    expandNode(selectedNodeId);
  };

  const handleFinalize = async () => {
    if (!selectedNodeId || !understanding) return;
    const node = nodeDataById[selectedNodeId];
    if (!node || node.isRoot) return;
    if (!canFinalizeRootCause) return;

    const storedVersionRaw =
      localStorage.getItem(`journey-version-${understanding.sessionId}`) ||
      (journeySessionId ? localStorage.getItem(`journey-version-${journeySessionId}`) : null) ||
      localStorage.getItem(`strategic-versionNumber-${understanding.sessionId}`);
    const storedVersionNumber = storedVersionRaw ? parseInt(storedVersionRaw, 10) : NaN;
    const versionNumber = Number.isFinite(storedVersionNumber) ? storedVersionNumber : undefined;

    try {
      setIsProcessingAction(true);
      setValidationWarning(null);
      const response = await apiRequest("POST", "/api/strategic-consultant/whys-tree/validate-root-cause", {
        rootCauseText: node.label,
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
        rootCause: node.label,
        input: understanding.userInput,
        versionNumber,
      });

      const finalizeData = await finalizeResponse.json();
      if (finalizeData?.versionNumber) {
        localStorage.setItem(`strategic-versionNumber-${sessionIdForNavigation}`, String(finalizeData.versionNumber));
        localStorage.setItem(`journey-version-${sessionIdForNavigation}`, String(finalizeData.versionNumber));
        if (journeySessionId) {
          localStorage.setItem(`journey-version-${journeySessionId}`, String(finalizeData.versionNumber));
        }
      }

      localStorage.setItem(`strategic-rootCause-${sessionIdForNavigation}`, node.label || "");
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
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleAddCustomWhy = () => {
    if (!customWhyText.trim() || !selectedNodeId || !treeMeta) return;
    const meta = nodeMetaRef.current.get(selectedNodeId);
    if (!meta) return;

    const slot = slotKey(meta.depth + 1, meta.index * MAX_CHILDREN);
    const customId = `custom-${Date.now()}`;

    const newActive = new Set(activeSlots);
    newActive.add(slot);

    const newSlotToId = { ...slotToNodeId, [slot]: customId };
    const newNodeData = {
      ...nodeDataById,
      [customId]: {
        label: customWhyText.trim(),
        summary: summarizeStatement(customWhyText.trim()),
        depth: meta.depth + 2,
        questionAsked: nodeDataById[selectedNodeId]?.label,
        nextQuestion: `Why is this? (${customWhyText.trim()})`,
        consideration: "Custom option",
      },
    };

    nodeMetaRef.current.set(customId, {
      parentId: selectedNodeId,
      depth: meta.depth + 1,
      index: meta.index * MAX_CHILDREN,
      questionAsked: nodeDataById[selectedNodeId]?.label,
    });

    setActiveSlots(newActive);
    setSlotToNodeId(newSlotToId);
    setNodeDataById(newNodeData);
    setCustomWhyText("");
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setIsPanning(true);
    panRef.current = { x: e.clientX, y: e.clientY, vx: vbRef.current.x, vy: vbRef.current.y };
  };

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vb = vbRef.current;
    const dx = (e.clientX - panRef.current.x) * (vb.w / r.width);
    const dy = (e.clientY - panRef.current.y) * (vb.h / r.height);
    const nb = { x: panRef.current.vx - dx, y: panRef.current.vy - dy, w: vb.w, h: vb.h };
    vbRef.current = nb;
    setViewBox(nb);
  };

  const onMouseUp = () => setIsPanning(false);

  const applyZoom = (factor: number, clientX?: number, clientY?: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vb = vbRef.current;
    const mx = clientX !== undefined ? clientX : r.left + r.width / 2;
    const my = clientY !== undefined ? clientY : r.top + r.height / 2;
    const vx = ((mx - r.left) / r.width) * vb.w + vb.x;
    const vy = ((my - r.top) / r.height) * vb.h + vb.y;
    const nb = { x: vx - (vx - vb.x) * factor, y: vy - (vy - vb.y) * factor, w: vb.w * factor, h: vb.h * factor };
    vbRef.current = nb;
    setViewBox(nb);
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      const f = e.deltaY > 0 ? 1.1 : 0.91;
      applyZoom(f, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  if (isLoadingUnderstanding || isGenerating) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[70vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const vbStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="flex-1 relative bg-background">
          <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
            <Button size="sm" onClick={() => applyZoom(0.9)} aria-label="Zoom in">
              +
            </Button>
            <Button size="sm" onClick={() => applyZoom(1.1)} aria-label="Zoom out">
              −
            </Button>
          </div>
          <svg
            ref={svgRef}
            className="w-full h-full"
            viewBox={vbStr}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="transparent" />
            {layout.edges.map((edge) => {
              const parentPos = posBySlot[edge.parent];
              const childPos = posBySlot[edge.child];
              const parentId = slotToNodeId[edge.parent];
              const childId = slotToNodeId[edge.child];
              if (!parentPos || !childPos || !parentId || !childId) return null;
              const isConfirmed = confirmedSet.has(childId);
              const isSelected = selectedNodeId === childId;
              const stroke = isConfirmed ? "#00d4aa" : isSelected ? "#f5b700" : "#7b879b";
              const x1 = parentPos.x;
              const y1 = parentPos.y + NODE_H;
              const x2 = childPos.x;
              const y2 = childPos.y;
              const midY = (y1 + y2) / 2;
              const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
              return (
                <path
                  key={edge.key}
                  d={path}
                  stroke={stroke}
                  strokeWidth={isConfirmed || isSelected ? 3 : 2}
                  fill="none"
                  opacity={1}
                />
              );
            })}

            {layout.nodes.map((node) => {
              const nodeId = slotToNodeId[node.key];
              if (!nodeId) return null;
              const data = nodeDataById[nodeId];
              if (!data) return null;
              const isSelected = nodeId === selectedNodeId;
              const isConfirmed = confirmedSet.has(nodeId);
              return (
                <g
                  key={node.key}
                  data-node
                  onClick={() => {
                    setSelectedNodeId(nodeId);
                    centerOnNodeId(nodeId);
                  }}
                >
                  <rect
                    x={node.x - NODE_W / 2}
                    y={node.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={12}
                    fill="#0f172a"
                    stroke={isConfirmed ? "#00d4aa" : isSelected ? "#f5b700" : "#3b4657"}
                    strokeWidth={isConfirmed || isSelected ? 2.5 : 1.5}
                  />
                  <foreignObject x={node.x - NODE_W / 2 + 10} y={node.y + 10} width={NODE_W - 20} height={NODE_H - 20}>
                    <div
                      style={{
                        color: "#e2e8f0",
                        fontSize: 11,
                        lineHeight: 1.2,
                        height: NODE_H - 20,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {data.summary || summarizeStatement(data.label)}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="w-96 border-l border-border bg-background/80 backdrop-blur p-4 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Badge variant="secondary">Five Whys</Badge>
            <h2 className="text-lg font-semibold">Path Navigator</h2>
            <p className="text-sm text-muted-foreground">
              Click a node to select it. Use “Select this as my why” to confirm and expand.
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Level {selectedDepth + 1}</Badge>
                  {isSelectedConfirmed ? (
                    <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-400/40" variant="outline">
                      Confirmed
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-300 border-amber-400/40" variant="outline">
                      Selected
                    </Badge>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Statement</div>
                  <div className="font-medium">{selectedNode.label}</div>
                </div>
                {selectedNode.consideration && (
                  <div>
                    <div className="text-xs text-muted-foreground">Consideration</div>
                    <div>{selectedNode.consideration}</div>
                  </div>
                )}
                {selectedNode.supporting_evidence && selectedNode.supporting_evidence.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Evidence</div>
                    <ul className="list-disc ml-4 space-y-1">
                      {selectedNode.supporting_evidence.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedNode.counter_arguments && selectedNode.counter_arguments.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Counterpoints</div>
                    <ul className="list-disc ml-4 space-y-1">
                      {selectedNode.counter_arguments.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!selectedNode.isRoot && (
                  <div className="pt-2 space-y-2">
                    {canConfirmWhy && (
                      <Button className="w-full" onClick={handleConfirmWhy} disabled={isProcessingAction}>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Select this as my why
                      </Button>
                    )}
                    {canFinalizeRootCause && (
                      <Button className="w-full" onClick={handleFinalize} disabled={isProcessingAction}>
                        {isProcessingAction ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        {isProcessingAction ? "Finalizing..." : "This is my root cause"}
                      </Button>
                    )}
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
