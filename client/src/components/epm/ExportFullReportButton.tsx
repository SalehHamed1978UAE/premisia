import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ExportFullReportButtonProps {
  sessionId: string;
  versionNumber?: number;
  programId?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ExportFullReportButton({
  sessionId,
  versionNumber,
  programId,
  variant = 'outline',
  size = 'sm',
  className,
}: ExportFullReportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Build query string - only append defined values to avoid ?sessionId=undefined
      const params = new URLSearchParams();
      
      if (sessionId) {
        params.append('sessionId', sessionId);
      }
      
      if (versionNumber !== undefined) {
        params.append('versionNumber', versionNumber.toString());
      }
      
      if (programId) {
        params.append('programId', programId);
      }

      // Make request to export endpoint
      const response = await fetch(`/api/exports/full-pass?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(error.error || `Export failed with status ${response.status}`);
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'qgentic-export.zip';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: 'Your full report has been downloaded',
      });
    } catch (error) {
      console.error('[Export] Error downloading report:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to download export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
      className={className}
      data-testid={`button-export-${sessionId}`}
    >
      <Download className="h-4 w-4 mr-2" />
      {isExporting ? 'Exporting...' : 'Export Report'}
    </Button>
  );
}
