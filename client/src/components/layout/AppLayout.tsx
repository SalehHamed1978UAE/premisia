import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showTopBar?: boolean;
}

export function AppLayout({ children, title, subtitle, showTopBar = true }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className="flex-1 overflow-y-auto">
        {showTopBar && title && subtitle && (
          <TopBar
            title={title}
            subtitle={subtitle}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
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
