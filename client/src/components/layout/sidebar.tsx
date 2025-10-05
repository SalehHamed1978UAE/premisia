import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Calendar, 
  Flag, 
  TrendingUp, 
  AlertTriangle, 
  Trophy, 
  DollarSign, 
  Users, 
  Bot,
  Settings,
  LogOut,
  X,
  Sparkles
} from "lucide-react";
import type { ViewType } from "@/pages/home-page";

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const navigation = [
  { 
    id: 'dashboard' as ViewType, 
    label: 'Dashboard', 
    icon: LayoutDashboard,
    description: 'Program overview'
  },
  { 
    id: 'timeline' as ViewType, 
    label: 'Timeline', 
    icon: Calendar,
    description: 'Schedule & tasks'
  },
  { 
    id: 'stage-gates' as ViewType, 
    label: 'Stage Gates', 
    icon: Flag,
    description: 'Milestone checkpoints'
  },
  { 
    id: 'kpis' as ViewType, 
    label: 'KPIs', 
    icon: TrendingUp,
    description: 'Performance metrics'
  },
  { 
    id: 'risks' as ViewType, 
    label: 'Risks', 
    icon: AlertTriangle,
    description: 'Risk management'
  },
  { 
    id: 'benefits' as ViewType, 
    label: 'Benefits', 
    icon: Trophy,
    description: 'Value realization'
  },
  { 
    id: 'funding' as ViewType, 
    label: 'Funding', 
    icon: DollarSign,
    description: 'Budget & expenses'
  },
  { 
    id: 'resources' as ViewType, 
    label: 'Resources', 
    icon: Users,
    description: 'Team management'
  },
  { 
    id: 'strategies' as ViewType, 
    label: 'Strategic Decisions', 
    icon: Sparkles,
    description: 'Strategy analysis & EPM'
  },
  { 
    id: 'ai-orchestrator' as ViewType, 
    label: 'AI Orchestrator', 
    icon: Bot,
    description: 'Multi-agent AI system'
  },
];

export function Sidebar({ currentView, onViewChange, isOpen, onToggle }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm lg:hidden z-40"
          onClick={onToggle}
        />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50",
        "w-64 bg-card border-r border-border",
        "flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">QData EPM</h2>
                <p className="text-xs text-muted-foreground">Enterprise PM</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="lg:hidden h-8 w-8"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">
                {user?.username?.substring(0, 2).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.username || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  user?.role === 'Admin' && "bg-primary/10 text-primary",
                  user?.role === 'Editor' && "bg-accent/10 text-accent",
                  user?.role === 'Viewer' && "bg-muted text-muted-foreground"
                )}>
                  {user?.role || 'Viewer'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={currentView === item.id ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start h-auto p-3",
                      currentView === item.id && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => {
                      onViewChange(item.id);
                      if (window.innerWidth < 1024) {
                        onToggle();
                      }
                    }}
                    data-testid={`nav-${item.id}`}
                  >
                    <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs opacity-70">{item.description}</div>
                    </div>
                  </Button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-3 border-primary/50 hover:bg-primary/10"
                onClick={() => {
                  setLocation('/strategic-consultant/input');
                  if (window.innerWidth < 1024) {
                    onToggle();
                  }
                }}
                data-testid="nav-strategic-consultant"
              >
                <Sparkles className="h-5 w-5 mr-3 flex-shrink-0 text-primary" />
                <div className="text-left">
                  <div className="font-medium">Strategic Consultant</div>
                  <div className="text-xs opacity-70">AI-powered strategy</div>
                </div>
              </Button>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            data-testid="nav-settings"
          >
            <Settings className="h-5 w-5 mr-3" />
            Settings
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
