import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Program } from "@shared/schema";

interface ProgramContextType {
  selectedProgramId: string | null;
  setSelectedProgramId: (id: string) => void;
  programs: Program[];
  isLoading: boolean;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(() => {
    return localStorage.getItem('selectedProgramId') || null;
  });

  const { data: programs = [], isLoading } = useQuery<Program[]>({
    queryKey: ['/api/programs'],
  });

  useEffect(() => {
    if (!selectedProgramId && programs.length > 0) {
      const firstProgram = programs[0].id;
      setSelectedProgramId(firstProgram);
      localStorage.setItem('selectedProgramId', firstProgram);
    }
  }, [programs, selectedProgramId]);

  useEffect(() => {
    if (selectedProgramId) {
      localStorage.setItem('selectedProgramId', selectedProgramId);
    }
  }, [selectedProgramId]);

  return (
    <ProgramContext.Provider value={{ selectedProgramId, setSelectedProgramId, programs, isLoading }}>
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  const context = useContext(ProgramContext);
  if (context === undefined) {
    throw new Error('useProgram must be used within a ProgramProvider');
  }
  return context;
}
