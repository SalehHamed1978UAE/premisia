import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ExportFullReportButtonProps {
  sessionId?: string;
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

  // Detect if user is on mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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

      const exportUrl = `/api/exports/full-pass?${params.toString()}`;

      // Mobile browsers don't support programmatic downloads well
      // Open the download URL directly in a new window
      if (isMobile) {
        console.log('[Export] Mobile detected - opening download URL directly');
        window.location.href = exportUrl;
        
        toast({
          title: 'Export started',
          description: 'Your download will begin shortly',
        });
        
        setIsExporting(false);
        return;
      }

      // Desktop: Use blob download for better UX
      console.log('[Export] Desktop - using blob download');
      const response = await fetch(exportUrl, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('[Export] Response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(error.error || `Export failed with status ${response.status}`);
      }

      // Get the blob from response
      const blob = await response.blob();
      console.log('[Export] Blob size:', blob.size, 'bytes');

      if (blob.size === 0) {
        throw new Error('Export file is empty');
      }

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
      
      console.log('[Export] Triggering download for:', filename);
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
      title={size === 'icon' ? (isExporting ? 'Exporting...' : 'Export Report') : undefined}
    >
      <Download className={size === 'icon' ? 'h-4 w-4' : 'h-4 w-4 mr-2'} />
      {size !== 'icon' && (isExporting ? 'Exporting...' : 'Export Report')}
    </Button>
  );
}
