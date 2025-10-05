import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Timeline } from "@/components/timeline/timeline";
import { StageGates } from "@/components/stagegates/stage-gates";
import { KPIs } from "@/components/kpis/kpis";
import { Risks } from "@/components/risks/risks";
import { Benefits } from "@/components/benefits/benefits";
import { Funding } from "@/components/funding/funding";
import { Resources } from "@/components/resources/resources";
import { AIOrchestrator } from "@/components/orchestrator/ai-orchestrator";
import { Strategies } from "@/components/strategies/strategies";

export type ViewType = 'dashboard' | 'timeline' | 'stage-gates' | 'kpis' | 'risks' | 'benefits' | 'funding' | 'resources' | 'strategies' | 'ai-orchestrator';

export default function HomePage() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'timeline':
        return <Timeline />;
      case 'stage-gates':
        return <StageGates />;
      case 'kpis':
        return <KPIs />;
      case 'risks':
        return <Risks />;
      case 'benefits':
        return <Benefits />;
      case 'funding':
        return <Funding />;
      case 'resources':
        return <Resources />;
      case 'strategies':
        return <Strategies />;
      case 'ai-orchestrator':
        return <AIOrchestrator />;
      default:
        return <Dashboard />;
    }
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return { title: 'Program Dashboard', subtitle: 'Overview of QData Enterprise Program Management' };
      case 'timeline':
        return { title: 'Timeline & Schedule', subtitle: 'Gantt chart view with task dependencies' };
      case 'stage-gates':
        return { title: 'Stage Gates', subtitle: 'Track program progression through defined gates' };
      case 'kpis':
        return { title: 'Key Performance Indicators', subtitle: 'Track and measure program success metrics' };
      case 'risks':
        return { title: 'Risk Management', subtitle: 'Track and mitigate program risks' };
      case 'benefits':
        return { title: 'Benefits Realization', subtitle: 'Track expected vs realized program benefits' };
      case 'funding':
        return { title: 'Funding & Budget', subtitle: 'Track budget allocation and expenditures' };
      case 'resources':
        return { title: 'Resource Management', subtitle: 'Manage team members and resource allocation' };
      case 'strategies':
        return { title: 'Strategic Decisions', subtitle: 'Review strategic analysis and EPM program structures' };
      case 'ai-orchestrator':
        return { title: 'AI Orchestrator', subtitle: 'Multi-agent AI system for code generation and review' };
      default:
        return { title: 'Program Dashboard', subtitle: 'Overview of QData Enterprise Program Management' };
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className="flex-1 overflow-y-auto">
        <TopBar 
          {...getViewTitle()}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <div className="p-6">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
