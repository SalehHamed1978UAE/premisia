import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface DocumentEnrichmentNotification {
  id: string;
  understandingId: string;
  entityCount: number;
  fileName: string | null;
  completedAt: string;
}

interface DocumentInsightsContextType {
  pendingInsights: DocumentEnrichmentNotification[];
  addNotification: (notification: DocumentEnrichmentNotification) => void;
  dismissNotification: (id: string) => void;
  openInsights: (understandingId: string) => void;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

const DocumentInsightsContext = createContext<DocumentInsightsContextType | null>(null);

const STORAGE_KEY = 'documentInsightsNotifications';
const SEEN_JOBS_KEY = 'seenEnrichmentJobs';

export function DocumentInsightsProvider({ children }: { children: ReactNode }) {
  const [pendingInsights, setPendingInsights] = useState<DocumentEnrichmentNotification[]>([]);
  const [isPanelOpen, setPanelOpen] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPendingInsights(parsed);
      } catch (error) {
        console.error('[DocumentInsights] Error loading from localStorage:', error);
      }
    }
  }, []);

  // Save to localStorage whenever pendingInsights changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingInsights));
  }, [pendingInsights]);

  const addNotification = (notification: DocumentEnrichmentNotification) => {
    // Check if we've already seen this job
    const seenJobs = JSON.parse(localStorage.getItem(SEEN_JOBS_KEY) || '[]');
    if (seenJobs.includes(notification.id)) {
      return;
    }

    // Add to seen jobs
    seenJobs.push(notification.id);
    localStorage.setItem(SEEN_JOBS_KEY, JSON.stringify(seenJobs));

    // Add to pending if not already there
    setPendingInsights(prev => {
      if (prev.find(n => n.id === notification.id)) {
        return prev;
      }
      return [...prev, notification];
    });
  };

  const dismissNotification = (id: string) => {
    setPendingInsights(prev => prev.filter(n => n.id !== id));
  };

  const openInsights = (understandingId: string) => {
    // Navigate to repository view with the understanding ID
    window.location.href = `/repository/${understandingId}`;
  };

  return (
    <DocumentInsightsContext.Provider
      value={{
        pendingInsights,
        addNotification,
        dismissNotification,
        openInsights,
        isPanelOpen,
        setPanelOpen,
      }}
    >
      {children}
    </DocumentInsightsContext.Provider>
  );
}

export function useDocumentInsights() {
  const context = useContext(DocumentInsightsContext);
  if (!context) {
    throw new Error('useDocumentInsights must be used within DocumentInsightsProvider');
  }
  return context;
}
