import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Menu, Bell, Search, FolderKanban } from "lucide-react";
import { useProgram } from "@/contexts/ProgramContext";

interface TopBarProps {
  title: string;
  subtitle: string;
  onToggleSidebar: () => void;
}

export function TopBar({ title, subtitle, onToggleSidebar }: TopBarProps) {
  const { selectedProgramId, setSelectedProgramId, programs, isLoading } = useProgram();

  return (
    <header className="sticky top-0 z-20 bg-card border-b border-border">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isLoading && programs.length > 0 && (
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedProgramId || ""} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="w-[200px]" data-testid="select-program">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id} data-testid={`select-program-${program.id}`}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            className="relative"
            data-testid="button-notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            data-testid="button-search"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
