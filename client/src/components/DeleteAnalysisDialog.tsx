import { useEffect, useState } from "react";
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

interface DeletionPreview {
  journeys: number;
  versions: number;
  epmPrograms: number;
  references: number;
}

interface DeleteAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onArchive: () => void;
  understandingId: string;
  isDeleting?: boolean;
}

export function DeleteAnalysisDialog({
  open,
  onOpenChange,
  onDelete,
  onArchive,
  understandingId,
  isDeleting = false,
}: DeleteAnalysisDialogProps) {
  const { data: preview, isLoading } = useQuery<DeletionPreview>({
    queryKey: [`/api/repository/${understandingId}/deletion-preview`],
    enabled: open && !!understandingId,
  });

  const totalArtifacts = preview 
    ? preview.journeys + preview.versions + preview.epmPrograms + preview.references 
    : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Delete Analysis?</AlertDialogTitle>
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
                    This analysis has {totalArtifacts} related {totalArtifacts === 1 ? 'item' : 'items'}:
                  </p>
                  <ul className="space-y-1 text-sm">
                    {preview && preview.journeys > 0 && (
                      <li className="flex justify-between">
                        <span>Strategic journeys</span>
                        <span className="font-semibold">{preview.journeys}</span>
                      </li>
                    )}
                    {preview && preview.versions > 0 && (
                      <li className="flex justify-between">
                        <span>Analysis versions</span>
                        <span className="font-semibold">{preview.versions}</span>
                      </li>
                    )}
                    {preview && preview.epmPrograms > 0 && (
                      <li className="flex justify-between">
                        <span>EPM programs</span>
                        <span className="font-semibold text-destructive">{preview.epmPrograms}</span>
                      </li>
                    )}
                    {preview && preview.references > 0 && (
                      <li className="flex justify-between">
                        <span>Research references</span>
                        <span className="font-semibold">{preview.references}</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">What would you like to do?</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p>• <strong>Archive</strong> - Hides this analysis and all related items (recommended)</p>
                    <p>• <strong>Delete</strong> - Permanently removes everything (cannot be undone)</p>
                  </div>
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isDeleting || isLoading} data-testid="button-cancel-delete">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onArchive();
              onOpenChange(false);
            }}
            disabled={isDeleting || isLoading}
            data-testid="button-archive"
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
            data-testid="button-confirm-delete"
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
