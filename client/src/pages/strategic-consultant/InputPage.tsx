import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileText, Image, FileSpreadsheet, X, Map, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";

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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledText = urlParams.get('text') || '';
  const journeySessionId = urlParams.get('journeySession');
  const [text, setText] = useState(prefilledText);

  // Fetch journey data if journeySession parameter exists
  const { data: journeyData, isLoading: loadingJourney } = useQuery({
    queryKey: ['journey', journeySessionId],
    queryFn: async () => {
      if (!journeySessionId) return null;
      const res = await fetch(`/api/journey-builder/${journeySessionId}`);
      if (!res.ok) throw new Error('Failed to fetch journey');
      return res.json();
    },
    enabled: !!journeySessionId,
  });

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
      let inputText = text.trim();
      
      // For files, extract text first (you could add file support to /understanding later)
      if (file) {
        toast({
          title: "File upload not yet supported",
          description: "Please paste the content as text for now",
          variant: "destructive"
        });
        clearInterval(progressInterval);
        setIsAnalyzing(false);
        return;
      }

      // Create understanding record immediately
      const understandingResponse = await fetch('/api/strategic-consultant/understanding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputText })
      });
      
      if (!understandingResponse.ok) {
        const errorData = await understandingResponse.json();
        throw new Error(errorData.error || 'Failed to create understanding');
      }
      
      const { understandingId, sessionId, classification } = await understandingResponse.json();
      
      // Store the input for reference
      localStorage.setItem(`strategic-input-${sessionId}`, inputText);

      clearInterval(progressInterval);
      setProgress(100);

      // Navigate to Classification page for user confirmation
      setTimeout(() => {
        setLocation(`/strategic-consultant/classification/${understandingId}`);
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

  // Handle journey step execution
  const handleJourneyStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      toast({
        title: "Input required",
        description: "Please provide your strategic input for this step",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 1, 95));
    }, 300);

    try {
      // Create understanding record with journey context
      const understandingResponse = await fetch('/api/strategic-consultant/understanding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: text.trim(),
          journeySessionId: journeySessionId,
          currentStep: journeyData?.journey?.steps?.[currentStepIndex]
        })
      });
      
      if (!understandingResponse.ok) {
        const errorData = await understandingResponse.json();
        throw new Error(errorData.error || 'Failed to create understanding');
      }
      
      const { understandingId, sessionId } = await understandingResponse.json();
      
      // Store the input for reference
      localStorage.setItem(`strategic-input-${sessionId}`, text.trim());

      // Mark journey step as complete
      if (journeySessionId) {
        await fetch(`/api/journey-builder/${journeySessionId}/complete-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stepId: journeyData?.journey?.steps?.[currentStepIndex]?.id,
            result: { understandingId, sessionId }
          })
        });
      }

      clearInterval(progressInterval);
      setProgress(100);

      // Navigate to Classification page
      setTimeout(() => {
        setLocation(`/strategic-consultant/classification/${understandingId}`);
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

  // Journey Mode UI
  if (journeySessionId) {
    if (loadingJourney) {
      return (
        <AppLayout
          title="Loading Journey..."
          subtitle="Please wait"
          onViewChange={(view) => setLocation('/')}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </AppLayout>
      );
    }

    if (!journeyData?.journey) {
      return (
        <AppLayout
          title="Journey Not Found"
          subtitle="Unable to load journey"
          onViewChange={(view) => setLocation('/')}
        >
          <div className="max-w-4xl mx-auto">
            <Alert variant="destructive">
              <AlertDescription>
                Journey not found. Please return to the Journeys page and try again.
              </AlertDescription>
            </Alert>
            <Button onClick={() => setLocation('/journeys')} className="mt-4">
              Back to Journeys
            </Button>
          </div>
        </AppLayout>
      );
    }

    const journey = journeyData.journey;
    const currentStep = journey.steps?.[currentStepIndex];
    const totalSteps = journey.steps?.length || 0;

    return (
      <AppLayout
        title={`${journey.name} - Step ${currentStepIndex + 1} of ${totalSteps}`}
        subtitle={currentStep?.name || 'Strategic Journey'}
        onViewChange={(view) => setLocation('/')}
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Journey Progress */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Map className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{journey.name}</CardTitle>
                  <CardDescription>
                    {journey.description}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  Step {currentStepIndex + 1} / {totalSteps}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {journey.steps?.map((step: any, index: number) => (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        index < currentStepIndex 
                          ? 'bg-green-500 text-white' 
                          : index === currentStepIndex 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {index < currentStepIndex ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-semibold">{index + 1}</span>
                        )}
                      </div>
                      {index < totalSteps - 1 && (
                        <div className={`flex-1 h-1 mx-1 ${
                          index < currentStepIndex ? 'bg-green-500' : 'bg-muted'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Step Input */}
          <Card>
            <CardHeader>
              <CardTitle>{currentStep?.name}</CardTitle>
              <CardDescription>
                {currentStep?.description || 'Provide your strategic input for this framework'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJourneyStepSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="journey-text-input">Your Strategic Input</Label>
                  <Textarea
                    id="journey-text-input"
                    data-testid="input-journey-step"
                    placeholder={`Provide context and information for ${currentStep?.name}...`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={8}
                    disabled={isAnalyzing}
                    className="resize-none"
                  />
                </div>

                {isAnalyzing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Processing step...</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} data-testid="progress-journey-step" />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/journeys')}
                    disabled={isAnalyzing}
                    data-testid="button-exit-journey"
                  >
                    Exit Journey
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isAnalyzing || !text.trim()}
                    data-testid="button-continue-journey"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Continue to Analysis
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Normal Mode UI (original flow)
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
