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
  totalAnalyses: number;
  totalJourneys: number;
  totalVersions: number;
  totalEpmPrograms: number;
  totalReferences: number;
}

interface BatchDeleteAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onArchive: () => void;
  understandingIds: string[];
  isDeleting?: boolean;
}

export function BatchDeleteAnalysisDialog({
  open,
  onOpenChange,
  onDelete,
  onArchive,
  understandingIds,
  isDeleting = false,
}: BatchDeleteAnalysisDialogProps) {
  const { data: preview, isLoading } = useQuery<BatchDeletionPreview>({
    queryKey: [`/api/repository/batch-deletion-preview`],
    queryFn: async () => {
      const response = await fetch('/api/repository/batch-deletion-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: understandingIds }),
      });
      if (!response.ok) throw new Error('Failed to fetch deletion preview');
      return response.json();
    },
    enabled: open && understandingIds.length > 0,
  });

  const totalArtifacts = preview 
    ? preview.totalJourneys + preview.totalVersions + preview.totalEpmPrograms + preview.totalReferences 
    : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Delete {understandingIds.length} {understandingIds.length === 1 ? 'Analysis' : 'Analyses'}?</AlertDialogTitle>
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
                    These {preview?.totalAnalyses || understandingIds.length} {(preview?.totalAnalyses || understandingIds.length) === 1 ? 'analysis has' : 'analyses have'} {totalArtifacts} related {totalArtifacts === 1 ? 'item' : 'items'}:
                  </p>
                  <ul className="space-y-1 text-sm">
                    {preview && preview.totalJourneys > 0 && (
                      <li className="flex justify-between">
                        <span>Strategic journeys</span>
                        <span className="font-semibold">{preview.totalJourneys}</span>
                      </li>
                    )}
                    {preview && preview.totalVersions > 0 && (
                      <li className="flex justify-between">
                        <span>Analysis versions</span>
                        <span className="font-semibold">{preview.totalVersions}</span>
                      </li>
                    )}
                    {preview && preview.totalEpmPrograms > 0 && (
                      <li className="flex justify-between">
                        <span>EPM programs</span>
                        <span className="font-semibold text-destructive">{preview.totalEpmPrograms}</span>
                      </li>
                    )}
                    {preview && preview.totalReferences > 0 && (
                      <li className="flex justify-between">
                        <span>Research references</span>
                        <span className="font-semibold">{preview.totalReferences}</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">What would you like to do?</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p>• <strong>Archive</strong> - Hides these analyses and all related items (recommended)</p>
                    <p>• <strong>Delete</strong> - Permanently removes everything (cannot be undone)</p>
                  </div>
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isDeleting || isLoading} data-testid="button-cancel-batch-delete">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onArchive();
              onOpenChange(false);
            }}
            disabled={isDeleting || isLoading}
            data-testid="button-batch-archive"
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
            data-testid="button-confirm-batch-delete"
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
