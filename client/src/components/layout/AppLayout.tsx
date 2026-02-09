import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showTopBar?: boolean;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  onViewChange?: () => void;
}

export function AppLayout({ 
  children, 
  title, 
  subtitle, 
  showTopBar = true,
  sidebarOpen: externalSidebarOpen,
  onSidebarToggle: externalOnToggle
}: AppLayoutProps) {
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const sidebarOpen = externalSidebarOpen !== undefined ? externalSidebarOpen : internalSidebarOpen;
  const onSidebarToggle = externalOnToggle || (() => setInternalSidebarOpen(!internalSidebarOpen));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={onSidebarToggle}
      />
      
      <main className="flex-1 overflow-y-auto">
        {showTopBar && title && subtitle && (
          <TopBar
            title={title}
            subtitle={subtitle}
            onToggleSidebar={onSidebarToggle}
          />
        )}
        
        {showTopBar && title && subtitle ? (
          <div className="p-6">
            {children}
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
