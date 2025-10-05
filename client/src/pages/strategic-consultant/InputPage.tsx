import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileText, Image, FileSpreadsheet, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppLayout } from "@/components/layout/AppLayout";

const SUPPORTED_FORMATS = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'image/jpeg': '.jpg, .jpeg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function InputPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setUploadError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadError(`File size exceeds 50MB limit (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB)`);
      setFile(null);
      return;
    }

    // Validate file type
    if (!Object.keys(SUPPORTED_FORMATS).includes(selectedFile.type)) {
      setUploadError(`Unsupported file format. Please upload: ${Object.values(SUPPORTED_FORMATS).join(', ')}`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim() && !file) {
      toast({
        title: "Input required",
        description: "Please provide text input or upload a file",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);

    // Simulate progress during analysis
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 1, 95));
    }, 1200);

    // Generate session ID
    const sessionId = `session-${Date.now()}`;

    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      
      if (text.trim()) {
        formData.append('text', text);
      }
      
      if (file) {
        formData.append('file', file);
      }

      // 120 second timeout for Claude analysis
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const response = await fetch('/api/strategic-consultant/analyze', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeout);
      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Analysis failed');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Analysis failed');
      }

      setProgress(100);

      // Navigate to analysis page
      setTimeout(() => {
        setLocation(`/strategic-consultant/analysis/${sessionId}`);
      }, 500);

    } catch (error: any) {
      clearInterval(progressInterval);
      
      if (error.name === 'AbortError') {
        toast({
          title: "Analysis timeout",
          description: "The analysis took longer than expected (>120s). Please try with a shorter input or contact support.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Analysis failed",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsAnalyzing(false);
      setProgress(0);
    }
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="h-4 w-4" />;
    
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return <FileSpreadsheet className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <AppLayout
      title="Strategic Consultant Agent"
      subtitle="Transform executive input into AI-analyzed strategic decisions"
      onViewChange={(view) => setLocation('/')}
    >
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Strategic Input</CardTitle>
            <CardDescription>
              Provide your strategic challenge via text or upload supporting documents (PDF, DOCX, Excel, Images)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="text-input">Text Input</Label>
                <Textarea
                  id="text-input"
                  data-testid="input-strategic-text"
                  placeholder="e.g., Our SaaS company needs to expand into enterprise markets. Current revenue is $10M ARR from SMB customers. We need to decide on enterprise features, sales strategy, and architecture..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  disabled={isAnalyzing}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file-input">Upload Document (Optional)</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="file-input"
                      data-testid="input-file-upload"
                      type="file"
                      onChange={handleFileChange}
                      disabled={isAnalyzing}
                      accept={Object.values(SUPPORTED_FORMATS).join(',')}
                      className="flex-1"
                    />
                    {file && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setFile(null)}
                        disabled={isAnalyzing}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {file && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-file-info">
                      {getFileIcon()}
                      <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)</span>
                    </div>
                  )}

                  {uploadError && (
                    <Alert variant="destructive" data-testid="alert-upload-error">
                      <AlertDescription>{uploadError}</AlertDescription>
                    </Alert>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Supported: PDF, DOCX, Excel, Images (max 50MB)
                  </p>
                </div>
              </div>

              {isAnalyzing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Analyzing with Claude Sonnet 4...</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} data-testid="progress-analysis" />
                  <p className="text-xs text-muted-foreground">
                    This may take up to 2 minutes for comprehensive analysis
                  </p>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isAnalyzing || (!text.trim() && !file) || !!uploadError}
                data-testid="button-analyze"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Strategy...
                  </>
                ) : (
                  'Analyze Strategy'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
