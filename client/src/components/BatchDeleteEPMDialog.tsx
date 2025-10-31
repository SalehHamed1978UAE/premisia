import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Archive, Trash2, Loader2 } from "lucide-react";

interface BatchDeletionPreview {
  totalPrograms: number;
  totalTaskAssignments: number;
  totalStrategyVersions: number;
}

interface BatchDeleteEPMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onArchive: () => void;
  programIds: string[];
  isDeleting?: boolean;
}

export function BatchDeleteEPMDialog({
  open,
  onOpenChange,
  onDelete,
  onArchive,
  programIds,
  isDeleting = false,
}: BatchDeleteEPMDialogProps) {
  const { data: preview, isLoading } = useQuery<BatchDeletionPreview>({
    queryKey: [`/api/strategy-workspace/epm/batch-deletion-preview`],
    queryFn: async () => {
      const response = await fetch('/api/strategy-workspace/epm/batch-deletion-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: programIds }),
      });
      if (!response.ok) throw new Error('Failed to fetch deletion preview');
      return response.json();
    },
    enabled: open && programIds.length > 0,
  });

  const totalArtifacts = preview 
    ? preview.totalTaskAssignments + preview.totalStrategyVersions 
    : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Delete {programIds.length} {programIds.length === 1 ? 'Program' : 'Programs'}?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4 pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="font-semibold text-foreground">
                    {totalArtifacts > 0 ? (
                      <>These {preview?.totalPrograms || programIds.length} {(preview?.totalPrograms || programIds.length) === 1 ? 'program has' : 'programs have'} {totalArtifacts} related {totalArtifacts === 1 ? 'item' : 'items'}:</>
                    ) : (
                      <>Deleting {preview?.totalPrograms || programIds.length} {(preview?.totalPrograms || programIds.length) === 1 ? 'program' : 'programs'}</>
                    )}
                  </p>
                  {totalArtifacts > 0 && (
                    <ul className="space-y-1 text-sm">
                      {preview && preview.totalTaskAssignments > 0 && (
                        <li className="flex justify-between">
                          <span>Task assignments</span>
                          <span className="font-semibold">{preview.totalTaskAssignments}</span>
                        </li>
                      )}
                      {preview && preview.totalStrategyVersions > 0 && (
                        <li className="flex justify-between">
                          <span>Strategy versions</span>
                          <span className="font-semibold">{preview.totalStrategyVersions}</span>
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">What would you like to do?</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p>• <strong>Archive</strong> - Hides these programs and all related items (recommended)</p>
                    <p>• <strong>Delete</strong> - Permanently removes everything (cannot be undone)</p>
                  </div>
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isDeleting || isLoading} data-testid="button-cancel-batch-delete-epm">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onArchive();
              onOpenChange(false);
            }}
            disabled={isDeleting || isLoading}
            data-testid="button-batch-archive-epm"
            className="flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            Archive Instead
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete();
            }}
            disabled={isDeleting || isLoading}
            data-testid="button-confirm-batch-delete-epm"
            className="flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete Everything
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
