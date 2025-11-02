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
  Target
} from "lucide-react";
import logoLight from "@assets/PREMISIA Think it through (1)-modified_1762085311768.png";
import logoDark from "@assets/PREMISIA Think it through_20251102_180550_0000_1762092638684.png";

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isOpen = false, onToggle = () => {} }: SidebarProps) {
  const { user } = useAuth();
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
          className="fixed inset-0 bg-background/80 backdrop-blur-sm lg:hidden z-40"
          onClick={onToggle}
          data-testid="sidebar-overlay"
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
              <img 
                src={logoLight} 
                alt="Premisia Logo" 
                className="h-8 w-auto dark:hidden"
              />
              <img 
                src={logoDark} 
                alt="Premisia Logo" 
                className="h-8 w-auto hidden dark:block"
              />
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
              <p className="text-sm font-medium text-white dark:text-white truncate">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'User'}
              </p>
              <p className="text-xs text-gray-300 dark:text-gray-300 truncate">
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  user?.role === 'Admin' && "bg-primary/10 text-primary",
                  user?.role === 'Editor' && "bg-accent/10 text-accent",
                  user?.role === 'Viewer' && "bg-muted text-gray-300"
                )}>
                  {user?.role || 'Viewer'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {/* Home */}
            <Button
              variant={location === '/' ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-auto p-3 text-white hover:text-white",
                location === '/' && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/')}
              data-testid="nav-home"
            >
              <Home className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Home</div>
                <div className="text-xs opacity-70">Get started</div>
              </div>
            </Button>

            {/* Strategic Consultant */}
            <Button
              variant={location.startsWith('/strategic-consultant') ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-auto p-3 text-white hover:text-white",
                location.startsWith('/strategic-consultant') && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/strategic-consultant/input')}
              data-testid="nav-strategic-consultant"
            >
              <Sparkles className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Strategic Consultant</div>
                <div className="text-xs opacity-70">AI-powered strategy</div>
              </div>
            </Button>

            {/* Strategies Hub */}
            <Button
              variant={location.startsWith('/strategies') ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-auto p-3 text-white hover:text-white",
                location.startsWith('/strategies') && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/strategies')}
              data-testid="nav-strategies"
            >
              <Target className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Strategies Hub</div>
                <div className="text-xs opacity-70">Unified initiatives</div>
              </div>
            </Button>

            {/* Analysis Repository */}
            <Button
              variant={location === '/repository' ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-auto p-3 text-white hover:text-white",
                location === '/repository' && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/repository')}
              data-testid="nav-repository"
            >
              <Archive className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Analysis Repository</div>
                <div className="text-xs opacity-70">Browse all analyses</div>
              </div>
            </Button>

            {/* EPM Programs */}
            <Button
              variant={location.startsWith('/strategy-workspace') ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-auto p-3 text-white hover:text-white",
                location.startsWith('/strategy-workspace') && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/strategy-workspace/programs')}
              data-testid="nav-epm-programs"
            >
              <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">EPM Programs</div>
                <div className="text-xs opacity-70">Generated programs</div>
              </div>
            </Button>

            {/* Journeys */}
            <Button
              variant={location === '/journeys' ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start h-auto p-3 text-white hover:text-white",
                location === '/journeys' && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate('/journeys')}
              data-testid="nav-journeys"
            >
              <Map className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Journeys</div>
                <div className="text-xs opacity-70">Strategic paths</div>
              </div>
            </Button>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:text-white"
            data-testid="nav-settings"
          >
            <Settings className="h-5 w-5 mr-3" />
            Settings
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300"
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
