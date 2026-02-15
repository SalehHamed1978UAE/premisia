import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { 
  Home,
  Sparkles,
  Archive,
  FileText,
  Settings,
  LogOut,
  X,
  LayoutDashboard,
  Map,
  Target,
  BarChart3,
  FolderOpen
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isOpen = false, onToggle = () => {} }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  const navigate = (path: string) => {
    setLocation(path);
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/95 lg:hidden z-40"
          onClick={onToggle}
          data-testid="sidebar-overlay"
        />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50",
        "w-64 bg-background/98 backdrop-blur-md border-r border-border",
        "flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="text-2xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                PREMISIA
              </div>
              <span className="px-2 py-1 text-xs font-semibold bg-primary/10 text-primary rounded">BETA</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="lg:hidden text-white hover:text-white"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Compact User Identity - Single line */}
        <header className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            {user?.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt="Profile" 
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-semibold text-xs">
                  {user?.firstName?.substring(0, 1)?.toUpperCase() || user?.email?.substring(0, 1)?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">
                {user?.firstName || user?.email?.split('@')[0] || 'User'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {user?.role || 'Viewer'}
              </span>
            </div>
          </div>
        </header>

        {/* Main Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {/* Home */}
            <Button
              variant={location === '/' ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-10 px-3 py-2 text-white hover:text-white",
                location === '/' && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/')}
              data-testid="nav-home"
            >
              <Home className="h-5 w-5 mr-3 flex-shrink-0" />
              <span className="font-medium">Home</span>
            </Button>

            {/* Strategic Consultant */}
            <Button
              variant={location.startsWith('/strategic-consultant') ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-10 px-3 py-2 text-white hover:text-white",
                location.startsWith('/strategic-consultant') && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/strategic-consultant/input')}
              data-testid="nav-strategic-consultant"
            >
              <Sparkles className="h-5 w-5 mr-3 flex-shrink-0" />
              <span className="font-medium">Strategic Consultant</span>
            </Button>

            {/* Marketing Consultant */}
            <Button
              variant={location === '/marketing-consultant' ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-10 px-3 py-2 text-white hover:text-white",
                location === '/marketing-consultant' && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/marketing-consultant')}
              data-testid="nav-marketing-consultant"
            >
              <BarChart3 className="h-5 w-5 mr-3 flex-shrink-0" />
              <span className="font-medium">Marketing Consultant</span>
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px] font-semibold bg-primary/10 text-primary">BETA</Badge>
            </Button>

            {/* My Discoveries - Marketing Consultant sub-item */}
            <Button
              variant={location === '/marketing-consultant/discoveries' ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-10 px-3 py-2 pl-8 text-white hover:text-white",
                location === '/marketing-consultant/discoveries' && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/marketing-consultant/discoveries')}
              data-testid="nav-my-discoveries"
            >
              <FolderOpen className="h-4 w-4 mr-3 flex-shrink-0" />
              <span className="font-medium text-sm">My Discoveries</span>
            </Button>

            {/* Strategies Hub */}
            <Button
              variant={location.startsWith('/strategies') ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-10 px-3 py-2 text-white hover:text-white",
                location.startsWith('/strategies') && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/strategies')}
              data-testid="nav-strategies"
            >
              <Target className="h-5 w-5 mr-3 flex-shrink-0" />
              <span className="font-medium">Strategies Hub</span>
            </Button>

            {/* Analysis Repository */}
            <Button
              variant={location === '/repository' ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-10 px-3 py-2 text-white hover:text-white",
                location === '/repository' && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/repository')}
              data-testid="nav-repository"
            >
              <Archive className="h-5 w-5 mr-3 flex-shrink-0" />
              <span className="font-medium">Analysis Repository</span>
            </Button>

            {/* EPM Programs */}
            <Button
              variant={location.startsWith('/strategy-workspace') ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-10 px-3 py-2 text-white hover:text-white",
                location.startsWith('/strategy-workspace') && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/strategy-workspace/programs')}
              data-testid="nav-epm-programs"
            >
              <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
              <span className="font-medium">EPM Programs</span>
            </Button>

            {/* Journeys */}
            <Button
              variant={location === '/journeys' ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-10 px-3 py-2 text-white hover:text-white",
                location === '/journeys' && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/journeys')}
              data-testid="nav-journeys"
            >
              <Map className="h-5 w-5 mr-3 flex-shrink-0" />
              <span className="font-medium">Journeys</span>
            </Button>
          </div>
        </nav>

        {/* Fixed Utility Footer - Icon only with tooltips */}
        <footer className="p-3 border-t border-border">
          <div className="flex items-center justify-around gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:text-white"
              title="Settings"
              aria-label="Settings"
              data-testid="nav-settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-red-400 hover:text-red-300"
              title="Logout"
              aria-label="Logout"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </footer>
      </aside>
    </>
  );
}
