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
  Sparkles,
  Archive,
  FileText
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
    id: 'strategies' as ViewType, 
    label: 'Strategic Decisions', 
    icon: Sparkles,
    description: 'Strategy analysis & EPM'
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
    id: 'ai-orchestrator' as ViewType, 
    label: 'AI Orchestrator', 
    icon: Bot,
    description: 'Multi-agent AI system'
  },
];

export function Sidebar({ currentView, onViewChange, isOpen, onToggle }: SidebarProps) {
  const { user } = useAuth();
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
                <h2 className="font-bold text-foreground">Qgentic EPM</h2>
                <p className="text-xs text-muted-foreground">Strategic EPM</p>
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
            {user?.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-semibold text-sm">
                  {user?.firstName?.substring(0, 1)?.toUpperCase() || user?.email?.substring(0, 1)?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'User'}
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

        {/* Strategic Consultant - Prominent CTA */}
        <div className="p-4 pb-2">
          <Button
            className="w-full justify-start h-auto p-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={() => {
              setLocation('/strategic-consultant/input');
              if (window.innerWidth < 1024) {
                onToggle();
              }
            }}
            data-testid="nav-strategic-consultant"
          >
            <Sparkles className="h-6 w-6 mr-3 flex-shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-base">Strategic Consultant</div>
              <div className="text-xs opacity-90">✨ AI-powered strategy</div>
            </div>
          </Button>
        </div>

        {/* Analysis Repository */}
        <div className="px-4 pb-0">
          <Button
            variant="outline"
            className="w-full justify-start h-auto p-3 border-2 hover:bg-accent"
            onClick={() => {
              setLocation('/repository');
              if (window.innerWidth < 1024) {
                onToggle();
              }
            }}
            data-testid="nav-repository"
          >
            <Archive className="h-5 w-5 mr-3 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium text-sm">Analysis Repository</div>
              <div className="text-xs opacity-70">Browse all analyses</div>
            </div>
          </Button>
        </div>

        {/* Strategy Workspace */}
        <div className="px-4 pb-2 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start h-auto p-3 border-2 hover:bg-accent"
            onClick={() => {
              setLocation('/strategy-workspace/programs');
              if (window.innerWidth < 1024) {
                onToggle();
              }
            }}
            data-testid="nav-strategy-workspace-programs"
          >
            <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium text-sm">EPM Programs</div>
              <div className="text-xs opacity-70">Generated programs</div>
            </div>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
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
            onClick={() => window.location.href = '/api/logout'}
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
