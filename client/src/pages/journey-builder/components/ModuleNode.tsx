import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Box, Brain, Target, BarChart, Layout, Users, Zap, FileText, 
  Settings, Database, Search, Lightbulb, TrendingUp, Grid, 
  Layers, Compass, Map, PieChart, Activity, LayoutGrid, MessageSquare
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ModuleNodeData {
  moduleId: string;
  label: string;
  icon: string;
  status: 'implemented' | 'stub';
  inputs: { id: string; name: string; type: string; required: boolean }[];
  outputs: { id: string; name: string; type: string }[];
  [key: string]: unknown;
}

const iconMap: Record<string, LucideIcon> = {
  'box': Box,
  'brain': Brain,
  'target': Target,
  'bar-chart': BarChart,
  'layout': Layout,
  'users': Users,
  'zap': Zap,
  'file-text': FileText,
  'settings': Settings,
  'database': Database,
  'search': Search,
  'lightbulb': Lightbulb,
  'trending-up': TrendingUp,
  'grid': Grid,
  'layers': Layers,
  'compass': Compass,
  'map': Map,
  'pie-chart': PieChart,
  'activity': Activity,
  'layout-grid': LayoutGrid,
  'message-square': MessageSquare,
};

function getIconComponent(iconName: string): LucideIcon {
  return iconMap[iconName] || Box;
}

function ModuleNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as ModuleNodeData;
  const Icon = getIconComponent(nodeData.icon);
  
  return (
    <div
      className={cn(
        'bg-card border rounded-lg shadow-sm min-w-[180px] transition-all',
        selected ? 'ring-2 ring-primary border-primary' : 'border-border',
        nodeData.status === 'stub' && 'opacity-80'
      )}
      data-testid={`node-module-${nodeData.moduleId}`}
    >
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 border-b rounded-t-lg',
        nodeData.status === 'implemented' ? 'bg-primary/5' : 'bg-muted/50'
      )}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate flex-1">{nodeData.label}</span>
        {nodeData.status === 'stub' && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            Stub
          </Badge>
        )}
      </div>
      
      <div className="relative px-3 py-2 min-h-[40px]">
        {nodeData.inputs.map((input, index) => (
          <Handle
            key={`input-${input.id}`}
            type="target"
            position={Position.Left}
            id={input.id}
            className={cn(
              'w-3 h-3 border-2 border-background',
              input.required ? 'bg-primary' : 'bg-muted-foreground'
            )}
            style={{ top: `${20 + index * 20}px` }}
            title={`${input.name} (${input.type})${input.required ? ' *' : ''}`}
          />
        ))}
        
        {nodeData.outputs.map((output, index) => (
          <Handle
            key={`output-${output.id}`}
            type="source"
            position={Position.Right}
            id={output.id}
            className="w-3 h-3 bg-primary border-2 border-background"
            style={{ top: `${20 + index * 20}px` }}
            title={`${output.name} (${output.type})`}
          />
        ))}
        
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <div className="space-y-1">
            {nodeData.inputs.map(input => (
              <div key={input.id} className="pl-2">
                {input.name}{input.required && <span className="text-destructive">*</span>}
              </div>
            ))}
          </div>
          <div className="space-y-1 text-right">
            {nodeData.outputs.map(output => (
              <div key={output.id} className="pr-2">
                {output.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ModuleNode = memo(ModuleNodeComponent);
