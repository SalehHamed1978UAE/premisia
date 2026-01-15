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

export default function MarketingInputPage() {
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

    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadError(`File size exceeds 50MB limit (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB)`);
      setFile(null);
      return;
    }

    if (!Object.keys(SUPPORTED_FORMATS).includes(selectedFile.type)) {
      setUploadError(`Unsupported file format. Please upload: ${Object.values(SUPPORTED_FORMATS).join(', ')}`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="h-4 w-4" />;
    
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return <FileSpreadsheet className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
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

    toast({
      title: "Coming Soon",
      description: "Marketing Consultant API is being developed. Check back soon!",
    });
  };

  return (
    <AppLayout
      title="Marketing Consultant Agent"
      subtitle="Transform your offering into targeted market segments"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Marketing Input</CardTitle>
            <CardDescription>
              Describe what you're building or selling. Include what problem it solves and who you think might need it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="marketing-text-input">Your Offering</Label>
                <Textarea
                  id="marketing-text-input"
                  data-testid="input-marketing-text"
                  placeholder="e.g., We built a tool that helps knowledge workers organize their documents and find information using AI. It refuses to hallucinate and shows sources. We're a 2-person team, no funding yet, trying to find our first 50 users..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  disabled={isAnalyzing}
                  className="resize-none"
                />
              </div>

              <div className="space-y-4">
                <Label>Supporting Documents (Optional)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <Input
                    type="file"
                    id="file-upload"
                    data-testid="button-upload-marketing"
                    className="hidden"
                    onChange={handleFileChange}
                    accept={Object.keys(SUPPORTED_FORMATS).join(',')}
                    disabled={isAnalyzing}
                  />
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {getFileIcon()}
                    <span className="text-sm text-muted-foreground">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      PDF, DOCX, Excel, Images (max 50MB)
                    </span>
                  </label>
                  {file && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setFile(null)}
                    >
                      <X className="h-4 w-4 mr-1" /> Remove file
                    </Button>
                  )}
                </div>
                {uploadError && (
                  <Alert variant="destructive">
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}
              </div>

              {isAnalyzing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Analyzing market segments...</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isAnalyzing || (!text.trim() && !file)}
                data-testid="button-start-segment-discovery"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Discovering Segments...
                  </>
                ) : (
                  'Start Segment Discovery'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
