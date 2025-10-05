import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import type { ViewType } from "@/pages/home-page";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  currentView?: ViewType;
  onViewChange?: (view: ViewType) => void;
}

export function AppLayout({ children, title, subtitle, currentView, onViewChange }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        currentView={currentView || 'dashboard'}
        onViewChange={onViewChange || (() => {})}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className="flex-1 overflow-y-auto">
        <TopBar
          title={title}
          subtitle={subtitle}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
