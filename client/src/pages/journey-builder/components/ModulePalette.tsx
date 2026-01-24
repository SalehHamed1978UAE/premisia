import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, ChevronLeft, ChevronRight, GripVertical,
  Box, Brain, Target, BarChart, Layout, Users, Zap, FileText, 
  Settings, Database, Search, Lightbulb, TrendingUp, Grid, 
  Layers, Compass, Map, PieChart, Activity, LayoutGrid, MessageSquare
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModuleInput {
  id: string;
  name: string;
  type: string;
  required: boolean;
}

interface ModuleOutput {
  id: string;
  name: string;
  type: string;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: 'implemented' | 'stub';
  inputs: ModuleInput[];
  outputs: ModuleOutput[];
}

interface ModulePaletteProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onDragStart: (event: React.DragEvent, module: Module) => void;
}

interface ModulesResponse {
  success: boolean;
  modules: Module[];
  count: number;
}

const CATEGORY_ORDER = ['input', 'analysis', 'strategy', 'customer', 'execution', 'output'];

const CATEGORY_LABELS: Record<string, string> = {
  input: 'Input Sources',
  analysis: 'Analysis Frameworks',
  strategy: 'Strategy Tools',
  customer: 'Customer Insights',
  execution: 'Execution Planning',
  output: 'Output & Export',
};

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

export function ModulePalette({ isCollapsed, onToggleCollapse, onDragStart }: ModulePaletteProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));
  
  const { data, isLoading } = useQuery<ModulesResponse>({
    queryKey: ['/api/custom-journey-builder/modules'],
  });

  const modules: Module[] = data?.modules || [];

  const groupedModules = useMemo(() => {
    const grouped: Record<string, Module[]> = {};
    
    for (const category of CATEGORY_ORDER) {
      grouped[category] = [];
    }
    
    for (const module of modules) {
      const category = module.category || 'analysis';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(module);
    }
    
    return grouped;
  }, [modules]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (isCollapsed) {
    return (
      <div className="w-10 h-full bg-card border-r flex flex-col items-center py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="mb-2"
          data-testid="button-expand-palette"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[250px] h-full bg-card border-r flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="font-medium text-sm">Modules</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          data-testid="button-collapse-palette"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Loading modules...
            </div>
          ) : (
            CATEGORY_ORDER.map(category => {
              const categoryModules = groupedModules[category];
              if (!categoryModules || categoryModules.length === 0) return null;
              
              const isExpanded = expandedCategories.has(category);
              
              return (
                <Collapsible
                  key={category}
                  open={isExpanded}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-2 py-1.5 h-auto"
                      data-testid={`button-category-${category}`}
                    >
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[category] || category}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pt-1">
                    {categoryModules.map(module => {
                      const Icon = getIconComponent(module.icon);
                      
                      return (
                        <div
                          key={module.id}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab',
                            'hover:bg-accent transition-colors',
                            'border border-transparent hover:border-border',
                            module.status === 'stub' && 'opacity-70'
                          )}
                          draggable
                          onDragStart={(e) => onDragStart(e, module)}
                          data-testid={`palette-module-${module.id}`}
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm flex-1 truncate">{module.name}</span>
                          <Badge
                            variant={module.status === 'implemented' ? 'default' : 'secondary'}
                            className={cn(
                              'text-[10px] px-1 py-0',
                              module.status === 'implemented' 
                                ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30' 
                                : ''
                            )}
                          >
                            {module.status === 'implemented' ? '✓' : '○'}
                          </Badge>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
