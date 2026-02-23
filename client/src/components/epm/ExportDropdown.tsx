import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Package, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/queryClient';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface ExportDropdownProps {
  sessionId?: string;
  versionNumber?: number;
  programId?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ExportDropdown({
  sessionId,
  versionNumber,
  programId,
  variant = 'outline',
  size = 'sm',
  className,
}: ExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const buildExportUrl = (format: string) => {
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

    return `/api/exports/${format}?${params.toString()}`;
  };

  const handleExport = async (format: string, formatName: string) => {
    setIsExporting(true);

    try {
      const exportUrl = buildExportUrl(format);

      console.log(`[Export] Using authenticated blob download for ${formatName}`);
      const response = await authFetch(exportUrl);

      console.log(`[Export] ${formatName} Response status:`, response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(error.error || `Export failed with status ${response.status}`);
      }

      // Get the blob from response
      const blob = await response.blob();
      console.log(`[Export] ${formatName} Blob size:`, blob.size, 'bytes');

      if (blob.size === 0) {
        throw new Error('Export file is empty');
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Generate filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `export.${format === 'full-pass' ? 'zip' : format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      console.log(`[Export] Triggering ${formatName} download for:`, filename);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: `${formatName} export successful`,
        description: `Your ${formatName.toLowerCase()} file has been downloaded`,
      });
    } catch (error) {
      console.error(`[Export] Error downloading ${formatName}:`, error);
      toast({
        title: `${formatName} export failed`,
        description: error instanceof Error ? error.message : 'Failed to download export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isExporting}
          className={className}
          data-testid={`button-export-dropdown-${sessionId}`}
        >
          <Download className={size === 'icon' ? 'h-4 w-4' : 'h-4 w-4 mr-2'} />
          {size !== 'icon' && (isExporting ? 'Exporting...' : 'Export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleExport('full-pass', 'Full Report')}
          disabled={isExporting}
        >
          <Package className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>Full Report (ZIP)</span>
            <span className="text-xs text-muted-foreground">All formats bundled</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleExport('wbs', 'WBS')}
          disabled={isExporting}
        >
          <FileCode className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>WBS (CSV)</span>
            <span className="text-xs text-muted-foreground">For PM tools import</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport('excel', 'Excel')}
          disabled={isExporting}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>Excel Workbook</span>
            <span className="text-xs text-muted-foreground">8 detailed sheets</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport('pdf', 'PDF')}
          disabled={isExporting}
        >
          <FileText className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>PDF Report</span>
            <span className="text-xs text-muted-foreground">Executive summary</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}