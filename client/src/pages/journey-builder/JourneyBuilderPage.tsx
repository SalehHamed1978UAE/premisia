import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Save, Play, CheckCircle, AlertTriangle, Square, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ModuleNode, type ModuleNodeData } from './components/ModuleNode';
import { ModulePalette, type Module } from './components/ModulePalette';
import { ConfigSidebar } from './components/ConfigSidebar';
import { apiRequest } from '@/lib/queryClient';

interface ValidationResult {
  success: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  executionOrder: string[];
}

interface ModulesResponse {
  success: boolean;
  modules: Module[];
  count: number;
}

interface NodeProgress {
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
  message?: string;
  output?: any;
  error?: string;
}

const nodeTypes: NodeTypes = {
  moduleNode: ModuleNode,
};

export default function JourneyBuilderPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const [journeyName, setJourneyName] = useState('Untitled Journey');
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ id: string; data: ModuleNodeData } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<Record<string, NodeProgress>>({});
  const [currentExecutingNode, setCurrentExecutingNode] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isExecuting,
          executionStatus: executionProgress[node.id]?.status,
          executionMessage: executionProgress[node.id]?.message,
        },
      }))
    );
  }, [isExecuting, executionProgress, setNodes]);

  useQuery<ModulesResponse>({
    queryKey: ['/api/custom-journey-builder/modules'],
  });

  const validateMutation = useMutation({
    mutationFn: async (payload: { nodes: unknown[]; edges: unknown[] }) => {
      const response = await apiRequest('POST', '/api/custom-journey-builder/validate', payload);
      return response.json() as Promise<ValidationResult>;
    },
    onSuccess: (data) => {
      setValidationErrors(data.errors || []);
      setValidationWarnings(data.warnings || []);
      
      if (data.isValid) {
        toast({
          title: 'Validation Passed',
          description: data.warnings.length > 0 
            ? `Journey is valid with ${data.warnings.length} warning(s)`
            : 'Journey configuration is valid and ready to run',
        });
      } else {
        toast({
          title: 'Validation Failed',
          description: `Found ${data.errors.length} error(s)`,
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: 'Validation Error',
        description: 'Failed to validate journey configuration',
        variant: 'destructive',
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { name: string; nodes: unknown[]; edges: unknown[] }) => {
      const response = await apiRequest('POST', '/api/custom-journey-builder/configs', payload);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.config?.id) {
        setJourneyId(data.config.id);
      }
      toast({
        title: 'Journey Saved',
        description: 'Your journey configuration has been saved',
      });
    },
    onError: () => {
      toast({
        title: 'Save Failed',
        description: 'Failed to save journey configuration',
        variant: 'destructive',
      });
    },
  });

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({
        ...params,
        id: `edge-${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}`,
        animated: true,
        style: { stroke: 'hsl(var(--primary))' },
      }, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const nodeData = node.data as ModuleNodeData;
    setSelectedNode({ id: node.id, data: nodeData });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const moduleData = event.dataTransfer.getData('application/reactflow');
      if (!moduleData) return;

      const module: Module = JSON.parse(moduleData);

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node = {
        id: `${module.id}-${Date.now()}`,
        type: 'moduleNode',
        position,
        data: {
          moduleId: module.id,
          label: module.name,
          icon: module.icon,
          status: module.status,
          inputs: module.inputs,
          outputs: module.outputs,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes]
  );

  const handleDragStart = useCallback((event: React.DragEvent, module: Module) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(module));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const getPayloads = useCallback(() => {
    const nodePayload = nodes.map((n: Node) => ({
      id: n.id,
      moduleId: (n.data as ModuleNodeData).moduleId,
      position: n.position,
    }));
    
    const edgePayload = edges.map((e: Edge) => ({
      id: e.id,
      sourceNodeId: e.source,
      sourcePortId: e.sourceHandle || '',
      targetNodeId: e.target,
      targetPortId: e.targetHandle || '',
    }));

    return { nodePayload, edgePayload };
  }, [nodes, edges]);

  const handleValidate = useCallback(() => {
    const { nodePayload, edgePayload } = getPayloads();
    validateMutation.mutate({ nodes: nodePayload, edges: edgePayload });
  }, [getPayloads, validateMutation]);

  const handleSave = useCallback(() => {
    const { nodePayload, edgePayload } = getPayloads();
    saveMutation.mutate({ name: journeyName, nodes: nodePayload, edges: edgePayload });
  }, [journeyName, getPayloads, saveMutation]);

  const handleCloseConfig = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleCancelExecution = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsExecuting(false);
    setExecutionProgress({});
    setCurrentExecutingNode(null);
    setExecutionId(null);
    toast({
      title: 'Execution Cancelled',
      description: 'The journey execution has been stopped',
    });
  }, [toast]);

  const handleSSEEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[Journey Builder] SSE event:', data);

      switch (data.type) {
        case 'execution_started':
          const initialProgress: Record<string, NodeProgress> = {};
          nodes.forEach((node) => {
            initialProgress[node.id] = { status: 'pending' };
          });
          setExecutionProgress(initialProgress);
          break;

        case 'node_start':
          setCurrentExecutingNode(data.nodeId);
          setExecutionProgress((prev) => ({
            ...prev,
            [data.nodeId]: { status: 'running', message: data.message || 'Starting...' },
          }));
          break;

        case 'node_progress':
          setExecutionProgress((prev) => ({
            ...prev,
            [data.nodeId]: {
              ...prev[data.nodeId],
              status: 'running',
              progress: data.progress,
              message: data.message,
            },
          }));
          break;

        case 'node_complete':
          setExecutionProgress((prev) => ({
            ...prev,
            [data.nodeId]: {
              status: 'completed',
              output: data.output,
              message: 'Completed',
            },
          }));
          break;

        case 'node_error':
          setExecutionProgress((prev) => ({
            ...prev,
            [data.nodeId]: {
              status: 'error',
              error: data.error,
              message: data.error || 'Error occurred',
            },
          }));
          break;

        case 'journey_complete':
          setIsExecuting(false);
          setCurrentExecutingNode(null);
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          toast({
            title: 'Journey Complete',
            description: 'All nodes have been executed successfully',
          });
          break;

        case 'journey_error':
          setIsExecuting(false);
          setCurrentExecutingNode(null);
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          toast({
            title: 'Execution Failed',
            description: data.error || 'An error occurred during execution',
            variant: 'destructive',
          });
          break;

        case 'user_input_required':
          // Execution paused for user input (e.g., Strategic Decisions)
          setIsExecuting(false);
          setCurrentExecutingNode(null);
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          toast({
            title: 'User Input Required',
            description: data.message || 'Please complete the next step',
          });
          // Navigate to the redirect URL (e.g., Decision Page)
          if (data.redirectUrl) {
            setLocation(data.redirectUrl);
          }
          break;

        default:
          console.log('[Journey Builder] Unknown SSE event type:', data.type);
      }
    } catch (error) {
      console.error('[Journey Builder] Error parsing SSE event:', error);
    }
  }, [nodes, toast, setLocation]);

  const handleRun = useCallback(async () => {
    if (nodes.length === 0) {
      toast({
        title: 'Cannot Run',
        description: 'Add at least one node to the journey',
        variant: 'destructive',
      });
      return;
    }

    const { nodePayload, edgePayload } = getPayloads();

    try {
      const validateResponse = await apiRequest('POST', '/api/custom-journey-builder/validate', {
        nodes: nodePayload,
        edges: edgePayload,
      });
      const validateResult = await validateResponse.json() as ValidationResult;

      setValidationErrors(validateResult.errors || []);
      setValidationWarnings(validateResult.warnings || []);

      if (!validateResult.isValid) {
        toast({
          title: 'Validation Failed',
          description: 'Fix errors before running the journey',
          variant: 'destructive',
        });
        return;
      }

      let configId = journeyId;
      if (!configId) {
        const saveResponse = await apiRequest('POST', '/api/custom-journey-builder/configs', {
          name: journeyName,
          nodes: nodePayload,
          edges: edgePayload,
        });
        const saveResult = await saveResponse.json();
        if (!saveResult.success || !saveResult.config?.id) {
          throw new Error('Failed to save journey configuration');
        }
        configId = saveResult.config.id;
        setJourneyId(configId);
      } else {
        const updateResponse = await apiRequest('PUT', `/api/custom-journey-builder/configs/${configId}`, {
          name: journeyName,
          nodes: nodePayload,
          edges: edgePayload,
        });
        const updateResult = await updateResponse.json();
        if (!updateResult.success) {
          throw new Error('Failed to update journey configuration');
        }
      }

      const createResponse = await apiRequest('POST', '/api/custom-journey-builder/executions', {
        configId,
        inputData: {},
      });
      const createResult = await createResponse.json();
      if (!createResult.success || !createResult.execution?.id) {
        throw new Error('Failed to create execution');
      }
      const newExecutionId = createResult.execution.id;
      setExecutionId(newExecutionId);

      const startResponse = await apiRequest('POST', `/api/custom-journey-builder/executions/${newExecutionId}/start`);
      const startResult = await startResponse.json();
      if (!startResult.success) {
        throw new Error(startResult.error || 'Failed to start execution');
      }

      setIsExecuting(true);
      const initialProgress: Record<string, NodeProgress> = {};
      nodes.forEach((node) => {
        initialProgress[node.id] = { status: 'pending' };
      });
      setExecutionProgress(initialProgress);

      const eventSource = new EventSource(`/api/custom-journey-builder/executions/${newExecutionId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = handleSSEEvent;

      eventSource.onerror = () => {
        console.error('[Journey Builder] SSE connection error');
        eventSource.close();
        eventSourceRef.current = null;
        setIsExecuting(false);
        toast({
          title: 'Connection Lost',
          description: 'Lost connection to the execution stream',
          variant: 'destructive',
        });
      };

    } catch (error: any) {
      console.error('[Journey Builder] Run error:', error);
      toast({
        title: 'Execution Failed',
        description: error.message || 'Failed to start journey execution',
        variant: 'destructive',
      });
    }
  }, [nodes, journeyName, journeyId, getPayloads, handleSSEEvent, toast]);

  const completedCount = Object.values(executionProgress).filter(p => p.status === 'completed').length;
  const totalNodes = nodes.length;

  return (
    <AppLayout>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        <div className="h-14 border-b bg-card px-4 flex items-center gap-4">
          <Input
            value={journeyName}
            onChange={(e) => setJourneyName(e.target.value)}
            className="max-w-xs font-medium"
            data-testid="input-journey-name"
            disabled={isExecuting}
          />
          
          <div className="flex-1" />
          
          {(validationErrors.length > 0 || validationWarnings.length > 0) && (
            <div className="flex items-center gap-2 text-sm">
              {validationErrors.length > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {validationErrors.length} error(s)
                </span>
              )}
              {validationWarnings.length > 0 && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  {validationWarnings.length} warning(s)
                </span>
              )}
            </div>
          )}
          
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={validateMutation.isPending || nodes.length === 0 || isExecuting}
            data-testid="button-validate"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Validate
          </Button>
          
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending || isExecuting}
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          
          {isExecuting ? (
            <Button
              variant="destructive"
              onClick={handleCancelExecution}
              data-testid="button-cancel"
            >
              <Square className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          ) : (
            <Button
              onClick={handleRun}
              disabled={nodes.length === 0}
              data-testid="button-run"
            >
              <Play className="h-4 w-4 mr-2" />
              Run
            </Button>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          <ModulePalette
            isCollapsed={paletteCollapsed}
            onToggleCollapse={() => setPaletteCollapsed(!paletteCollapsed)}
            onDragStart={handleDragStart}
          />

          <div ref={reactFlowWrapper} className="flex-1 h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid
              snapGrid={[15, 15]}
              className="bg-muted/30"
            >
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const data = node.data as ModuleNodeData;
                  if (isExecuting) {
                    const progress = executionProgress[node.id];
                    if (progress?.status === 'completed') return 'hsl(142, 76%, 36%)';
                    if (progress?.status === 'running') return 'hsl(217, 91%, 60%)';
                    if (progress?.status === 'error') return 'hsl(0, 84%, 60%)';
                    return 'hsl(var(--muted-foreground))';
                  }
                  return data?.status === 'implemented' 
                    ? 'hsl(var(--primary))' 
                    : 'hsl(var(--muted-foreground))';
                }}
                maskColor="rgba(0,0,0,0.1)"
              />
              <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
            </ReactFlow>
          </div>

          <ConfigSidebar
            selectedNode={selectedNode}
            onClose={handleCloseConfig}
          />

          {isExecuting && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-card border rounded-lg shadow-lg p-4 min-w-[280px] z-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="font-medium text-sm">Executing Journey</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelExecution}
                  className="h-6 px-2 text-xs"
                  data-testid="button-cancel-overlay"
                >
                  Cancel
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Progress:</span>
                <span className="font-medium">{completedCount} / {totalNodes} nodes</span>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${totalNodes > 0 ? (completedCount / totalNodes) * 100 : 0}%` }}
                />
              </div>
              {currentExecutingNode && executionProgress[currentExecutingNode]?.message && (
                <div className="mt-2 text-xs text-muted-foreground truncate">
                  {executionProgress[currentExecutingNode].message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
