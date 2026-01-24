import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Save, Play, CheckCircle, AlertTriangle } from 'lucide-react';
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

const nodeTypes: NodeTypes = {
  moduleNode: ModuleNode,
};

export default function JourneyBuilderPage() {
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const [journeyName, setJourneyName] = useState('Untitled Journey');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ id: string; data: ModuleNodeData } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

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
    onSuccess: () => {
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

  const handleValidate = useCallback(() => {
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

    validateMutation.mutate({ nodes: nodePayload, edges: edgePayload });
  }, [nodes, edges, validateMutation]);

  const handleSave = useCallback(() => {
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

    saveMutation.mutate({ name: journeyName, nodes: nodePayload, edges: edgePayload });
  }, [journeyName, nodes, edges, saveMutation]);

  const handleCloseConfig = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <AppLayout>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        <div className="h-14 border-b bg-card px-4 flex items-center gap-4">
          <Input
            value={journeyName}
            onChange={(e) => setJourneyName(e.target.value)}
            className="max-w-xs font-medium"
            data-testid="input-journey-name"
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
            disabled={validateMutation.isPending || nodes.length === 0}
            data-testid="button-validate"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Validate
          </Button>
          
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          
          <Button
            disabled
            title="Run functionality coming soon"
            data-testid="button-run"
          >
            <Play className="h-4 w-4 mr-2" />
            Run
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
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
        </div>
      </div>
    </AppLayout>
  );
}
