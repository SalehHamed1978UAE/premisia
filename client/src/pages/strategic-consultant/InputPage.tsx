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
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Get pre-filled text from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledText = urlParams.get('text') || '';
  const [text, setText] = useState(prefilledText);

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

    // Simulate progress with logarithmic easing (slows down naturally)
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 1;
      // Use logarithmic curve: fast at start, very slow near end
      // This reaches ~85% after 60 seconds, ~90% after 2 minutes
      const targetProgress = 95 * (1 - Math.exp(-currentProgress / 100));
      setProgress(Math.floor(targetProgress));
    }, 300); // Update every 300ms for smoother feel

    try {
      // Generate session ID
      const sessionId = `session-${Date.now()}`;

      let analyzeResponse;
      let inputText = text.trim();
      
      if (file) {
        // For files, send them for extraction and analysis
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        
        analyzeResponse = await fetch('/api/strategic-consultant/analyze', {
          method: 'POST',
          body: formData
        });
      } else {
        // For text-only input, send JSON to analyze endpoint
        analyzeResponse = await fetch('/api/strategic-consultant/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: inputText,
            sessionId
          })
        });
      }
      
      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || 'Analysis failed');
      }
      
      const analyzeData = await analyzeResponse.json();
      
      // Store the processed input content with fallback to original text
      const storedInput = analyzeData.inputContent || inputText;
      
      if (!storedInput) {
        throw new Error('No valid input text could be extracted');
      }
      
      localStorage.setItem(`strategic-input-${sessionId}`, storedInput);

      clearInterval(progressInterval);
      setProgress(100);

      // Navigate to WhysTreePage (new flow)
      setTimeout(() => {
        setLocation(`/strategic-consultant/whys-tree/${sessionId}`);
      }, 300);

    } catch (error: any) {
      clearInterval(progressInterval);
      
      toast({
        title: "Processing failed",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
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
                    <span className="text-muted-foreground">Preparing strategic analysis...</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} data-testid="progress-analysis" />
                  <p className="text-xs text-muted-foreground">
                    Processing your input and preparing the analysis workflow
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
                    Starting Analysis...
                  </>
                ) : (
                  'Start Strategic Analysis'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
