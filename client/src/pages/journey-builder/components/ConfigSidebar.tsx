import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  X, ArrowRight, ArrowLeft, Info,
  Box, Brain, Target, BarChart, Layout, Users, Zap, FileText, 
  Settings, Database, Search, Lightbulb, TrendingUp, Grid, 
  Layers, Compass, Map, PieChart, Activity, LayoutGrid, MessageSquare
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleNodeData } from './ModuleNode';

interface ConfigSidebarProps {
  selectedNode: { id: string; data: ModuleNodeData } | null;
  onClose: () => void;
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

export function ConfigSidebar({ selectedNode, onClose }: ConfigSidebarProps) {
  if (!selectedNode) {
    return null;
  }

  const { data } = selectedNode;
  const Icon = getIconComponent(data.icon);

  return (
    <div className="w-[300px] h-full bg-card border-l flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-medium">Module Configuration</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-config"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              data.status === 'implemented' ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{data.label}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={data.status === 'implemented' ? 'default' : 'secondary'}
                  className={cn(
                    'text-xs',
                    data.status === 'implemented' 
                      ? 'bg-green-500/20 text-green-600' 
                      : ''
                  )}
                >
                  {data.status === 'implemented' ? 'Implemented' : 'Stub'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Inputs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.inputs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inputs</p>
              ) : (
                data.inputs.map(input => (
                  <div
                    key={input.id}
                    className="flex items-center justify-between text-sm"
                    data-testid={`config-input-${input.id}`}
                  >
                    <span className={cn(input.required && 'font-medium')}>
                      {input.name}
                      {input.required && <span className="text-destructive ml-1">*</span>}
                    </span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {input.type}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Outputs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.outputs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outputs</p>
              ) : (
                data.outputs.map(output => (
                  <div
                    key={output.id}
                    className="flex items-center justify-between text-sm"
                    data-testid={`config-output-${output.id}`}
                  >
                    <span>{output.name}</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {output.type}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Module-specific configuration options will be available here in a future update.
              </p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
