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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ClarificationModal } from "@/components/ClarificationModal";
import { getAccessToken } from "@/lib/supabase";

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

type BudgetConstraint = {
  amount?: number;
  timeline?: number;
};

type ConstraintMode = 'discovery' | 'constrained';

export default function InputPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<any[]>([]);
  const [isCheckingAmbiguities, setIsCheckingAmbiguities] = useState(false);
  const [pendingFileMetadata, setPendingFileMetadata] = useState<{ fileName: string; content: string; metadata: any } | null>(null);

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledText = urlParams.get('text') || '';
  const journeySessionId = urlParams.get('journeySession');
  const discoveryId = urlParams.get('discoveryId');
  const templateId = urlParams.get('templateId');
  const journeyType = urlParams.get('journeyType');
  const [text, setText] = useState(() => {
    if (prefilledText) return prefilledText;
    try {
      return sessionStorage.getItem('strategic-input-draft') || '';
    } catch {
      return '';
    }
  });
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [budgetMode, setBudgetMode] = useState<'none' | 'set'>('none');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetTimelineMonths, setBudgetTimelineMonths] = useState('');

  useEffect(() => {
    try {
      if (text) {
        sessionStorage.setItem('strategic-input-draft', text);
      } else {
        sessionStorage.removeItem('strategic-input-draft');
      }
    } catch {}
  }, [text]);

  // Fetch strategic summary from Segment Discovery if discoveryId is present
  useEffect(() => {
    if (!discoveryId) return; // No discovery context to load
    
    const fetchSummary = async () => {
      setIsLoadingSummary(true);
      try {
        const token = await getAccessToken();
        const summaryHeaders: Record<string, string> = {};
        if (token) summaryHeaders['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/marketing-consultant/strategic-summary/${discoveryId}`, {
          credentials: 'include',
          headers: summaryHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.summary) {
            setText(data.summary);
            toast({
              title: "Context loaded",
              description: "Your segment discovery insights have been loaded. Review and start your strategic analysis.",
            });
          }
        } else if (res.status === 401 || res.status === 403) {
          toast({
            title: "Access denied",
            description: "You don't have access to this segment discovery. Please enter your context manually.",
            variant: "destructive",
          });
        } else if (res.status === 404) {
          toast({
            title: "Discovery not found",
            description: "The segment discovery could not be found. Please enter your context manually.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Could not load context",
            description: "Failed to load segment discovery insights. You can still enter your context manually.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('[InputPage] Failed to fetch strategic summary:', error);
        toast({
          title: "Connection error",
          description: "Could not connect to load context. Please try again or enter your context manually.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSummary(false);
      }
    };
    
    fetchSummary();
  }, [discoveryId, toast]);

  // Fetch journey data if journeySession parameter exists
  const { data: journeyData, isLoading: loadingJourney, refetch: refetchJourney } = useQuery({
    queryKey: ['journey', journeySessionId],
    queryFn: async () => {
      if (!journeySessionId) return null;
      const token = await getAccessToken();
      const journeyHeaders: Record<string, string> = {};
      if (token) journeyHeaders['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/journey-builder/${journeySessionId}`, { headers: journeyHeaders });
      if (!res.ok) throw new Error('Failed to fetch journey');
      return res.json();
    },
    enabled: !!journeySessionId,
  });

  // Get current step index from journey data (from server state)
  const currentStepIndex = journeyData?.journey?.currentStepIndex || 0;

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

  const handleFileSubmit = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setProgress(20);

    try {
      // Step 1: Extract file content only (no analysis)
      const formData = new FormData();
      formData.append('file', file);

      const extractToken = await getAccessToken();
      const extractHeaders: Record<string, string> = {};
      if (extractToken) extractHeaders['Authorization'] = `Bearer ${extractToken}`;
      const extractResponse = await fetch('/api/strategic-consultant/extract-file', {
        method: 'POST',
        credentials: 'include',
        headers: extractHeaders,
        body: formData,
      });

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json();
        throw new Error(errorData.error || 'File extraction failed');
      }

      const { content, metadata, fileName } = await extractResponse.json();
      
      toast({
        title: "File extracted",
        description: `Content extracted from ${file.name}`,
      });

      setProgress(40);

      // Step 2: Prepare input with separate text and content fields
      // Store file metadata for enrichment job creation
      const fileMetadata = {
        fileName: fileName || file.name,
        content: content,
        metadata: metadata || {},
      };

      // Prepare full input with document content
      const userText = text.trim();
      const finalInput = userText 
        ? `${userText}\n\n--- Content from ${file.name} ---\n${content}`
        : content;

      // Check for ambiguities - send as object so backend can separate location checking from general ambiguity checking
      const ambiguityToken = await getAccessToken();
      const ambiguityHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (ambiguityToken) ambiguityHeaders['Authorization'] = `Bearer ${ambiguityToken}`;
      const ambiguityResponse = await fetch('/api/strategic-consultant/check-ambiguities', {
        method: 'POST',
        headers: ambiguityHeaders,
        body: JSON.stringify({ 
          userInput: {
            text: userText || '',  // User's text only (for location disambiguation)
            fullInput: finalInput   // Full input including document (for general ambiguity detection)
          }
        })
      });

      if (!ambiguityResponse.ok) {
        throw new Error('Failed to check ambiguities');
      }

      const ambiguityResult = await ambiguityResponse.json();
      setProgress(60);

      if (ambiguityResult.hasAmbiguities) {
        // Show clarification modal
        setText(finalInput); // Save extracted content to state for later use
        setPendingFileMetadata(fileMetadata); // Save file metadata for later use
        setClarificationQuestions(ambiguityResult.questions);
        setShowClarificationModal(true);
        setIsAnalyzing(false);
        setProgress(0);
      } else {
        // No ambiguities, proceed directly to understanding with file metadata
        await startStrategicUnderstanding(finalInput, null, fileMetadata);
      }

    } catch (error: any) {
      setIsAnalyzing(false);
      setProgress(0);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process file",
        variant: "destructive"
      });
    }
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

    // Route to file upload handler if file present
    if (file) {
      await handleFileSubmit();
      return;
    }

    // Step 1: Check for ambiguities first
    setIsCheckingAmbiguities(true);
    try {
      const ambToken = await getAccessToken();
      const ambHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (ambToken) ambHeaders['Authorization'] = `Bearer ${ambToken}`;
      const ambiguityResponse = await fetch('/api/strategic-consultant/check-ambiguities', {
        method: 'POST',
        headers: ambHeaders,
        body: JSON.stringify({ userInput: text.trim() })
      });

      if (!ambiguityResponse.ok) {
        throw new Error('Failed to check ambiguities');
      }

      const ambiguityResult = await ambiguityResponse.json();

      if (ambiguityResult.hasAmbiguities) {
        // Show clarification modal
        setClarificationQuestions(ambiguityResult.questions);
        setShowClarificationModal(true);
        setIsCheckingAmbiguities(false);
      } else {
        // No ambiguities, proceed directly
        setIsCheckingAmbiguities(false);
        await startStrategicUnderstanding(text.trim(), null);
      }
    } catch (error: any) {
      setIsCheckingAmbiguities(false);
      toast({
        title: "Check failed",
        description: "Could not check for ambiguities. Proceeding with original input.",
        variant: "default"
      });
      // Proceed anyway on error
      await startStrategicUnderstanding(text.trim(), null);
    }
  };

  const startStrategicUnderstanding = async (input: string, clarifications: Record<string, string> | null, fileMetadata?: { fileName: string; content: string; metadata: any }) => {
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
      const budgetConstraint = buildBudgetConstraint();
      const constraintMode = buildConstraintMode();

      // Create understanding record with optional clarifications and file metadata
      const undToken = await getAccessToken();
      const undHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (undToken) undHeaders['Authorization'] = `Bearer ${undToken}`;
      const understandingResponse = await fetch('/api/strategic-consultant/understanding', {
        method: 'POST',
        headers: undHeaders,
        body: JSON.stringify({ 
          input: input,
          clarifications: clarifications,
          fileMetadata: fileMetadata, // Pass file metadata for enrichment job creation
          budgetConstraint: budgetConstraint || undefined,
          constraintMode,
          templateId: templateId || undefined // Pass template ID if running a custom journey
        })
      });
      
      if (!understandingResponse.ok) {
        const errorData = await understandingResponse.json();
        throw new Error(errorData.error || 'Failed to create understanding');
      }
      
      const { understandingId, sessionId, classification } = await understandingResponse.json();
      
      // Store the input for reference
      localStorage.setItem(`strategic-input-${sessionId}`, input);

      clearInterval(progressInterval);
      setProgress(100);

      // Navigate to Classification page for user confirmation
      // Pass templateId or journeyType if specified
      setTimeout(() => {
        const params = new URLSearchParams();
        if (templateId) params.set('templateId', templateId);
        if (journeyType) params.set('journeyType', journeyType);
        const queryString = params.toString();
        try { sessionStorage.removeItem('strategic-input-draft'); } catch {}
        setLocation(`/strategic-consultant/classification/${understandingId}${queryString ? '?' + queryString : ''}`);
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

  const handleClarificationsSubmit = (answers: Record<string, string | string[]>) => {
    setShowClarificationModal(false);

    // Convert answers to human-readable clarifications
    const clarifications: Record<string, string> = {};
    clarificationQuestions.forEach(q => {
      const answer = answers[q.id];
      if (Array.isArray(answer)) {
        // Multi-select: join all selected labels
        const selectedLabels = answer
          .map(val => q.options.find((opt: any) => opt.value === val)?.label)
          .filter(Boolean)
          .join(', ');
        if (selectedLabels) {
          clarifications[q.question] = selectedLabels;
        }
      } else {
        // Single select
        const selectedOption = q.options.find((opt: any) => opt.value === answer);
        if (selectedOption) {
          clarifications[q.question] = selectedOption.label;
        }
      }
    });

    // Pass file metadata if available (from file upload flow)
    startStrategicUnderstanding(text.trim(), clarifications, pendingFileMetadata || undefined);
  };

  const handleSkipClarifications = () => {
    setShowClarificationModal(false);
    // Pass file metadata if available (from file upload flow)
    startStrategicUnderstanding(text.trim(), null, pendingFileMetadata || undefined);
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="h-4 w-4" />;
    
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return <FileSpreadsheet className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const buildBudgetConstraint = (): BudgetConstraint | null => {
    if (budgetMode !== 'set') return null;

    const parseNumeric = (value: string): number | undefined => {
      if (!value) return undefined;
      const parsed = Number(value.replace(/[$,\s]/g, ''));
      if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
      return Math.round(parsed);
    };

    const amount = parseNumeric(budgetAmount);
    const timeline = parseNumeric(budgetTimelineMonths);
    if (!amount && !timeline) return null;

    const constraint: BudgetConstraint = {};
    if (amount) constraint.amount = amount;
    if (timeline) constraint.timeline = timeline;
    return constraint;
  };

  const buildConstraintMode = (): ConstraintMode => {
    return budgetMode === 'set' ? 'constrained' : 'discovery';
  };

  // Handle journey clarifications submission
  const handleJourneyClarificationsSubmit = (answers: Record<string, string | string[]>) => {
    setShowClarificationModal(false);

    // Convert answers to human-readable clarifications
    const clarifications: Record<string, string> = {};
    clarificationQuestions.forEach(q => {
      const answer = answers[q.id];
      if (Array.isArray(answer)) {
        // Multi-select: join all selected labels
        const selectedLabels = answer
          .map(val => q.options.find((opt: any) => opt.value === val)?.label)
          .filter(Boolean)
          .join(', ');
        if (selectedLabels) {
          clarifications[q.question] = selectedLabels;
        }
      } else {
        // Single select
        const selectedOption = q.options.find((opt: any) => opt.value === answer);
        if (selectedOption) {
          clarifications[q.question] = selectedOption.label;
        }
      }
    });

    startJourneyStepUnderstanding(text.trim(), clarifications);
  };

  const handleJourneySkipClarifications = () => {
    setShowClarificationModal(false);
    startJourneyStepUnderstanding(text.trim(), null);
  };

  // Handle journey step execution (with ambiguity check)
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

    // Step 1: Check for ambiguities first (same as normal flow)
    setIsCheckingAmbiguities(true);
    try {
      const jAmbToken = await getAccessToken();
      const jAmbHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jAmbToken) jAmbHeaders['Authorization'] = `Bearer ${jAmbToken}`;
      const ambiguityResponse = await fetch('/api/strategic-consultant/check-ambiguities', {
        method: 'POST',
        headers: jAmbHeaders,
        body: JSON.stringify({ userInput: text.trim() })
      });

      if (!ambiguityResponse.ok) {
        throw new Error('Failed to check ambiguities');
      }

      const ambiguityResult = await ambiguityResponse.json();

      if (ambiguityResult.hasAmbiguities) {
        // Save trimmed input before showing modal (clarifications will be applied when submitted)
        const trimmedInput = text.trim();
        setText(trimmedInput);
        
        // Show clarification modal
        setClarificationQuestions(ambiguityResult.questions);
        setShowClarificationModal(true);
        setIsCheckingAmbiguities(false);
      } else {
        // No ambiguities, proceed directly
        setIsCheckingAmbiguities(false);
        await startJourneyStepUnderstanding(text.trim(), null);
      }
    } catch (error: any) {
      setIsCheckingAmbiguities(false);
      toast({
        title: "Check failed",
        description: "Could not check for ambiguities. Proceeding with original input.",
        variant: "default"
      });
      // Proceed anyway on error
      await startJourneyStepUnderstanding(text.trim(), null);
    }
  };

  // Handle journey step execution with clarifications
  const startJourneyStepUnderstanding = async (input: string, clarifications: Record<string, string> | null) => {
    setIsAnalyzing(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 1, 95));
    }, 300);

    try {
      const budgetConstraint = buildBudgetConstraint();
      const constraintMode = buildConstraintMode();

      // Create understanding record with journey context and clarifications
      const jUndToken = await getAccessToken();
      const jUndHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jUndToken) jUndHeaders['Authorization'] = `Bearer ${jUndToken}`;
      const understandingResponse = await fetch('/api/strategic-consultant/understanding', {
        method: 'POST',
        headers: jUndHeaders,
        body: JSON.stringify({ 
          input: input,
          clarifications: clarifications,
          budgetConstraint: budgetConstraint || undefined,
          constraintMode,
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

      // Mark journey step as complete and get next step info
      let stepCompletion;
      if (journeySessionId) {
        const complToken = await getAccessToken();
        const complHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (complToken) complHeaders['Authorization'] = `Bearer ${complToken}`;
        const completeResponse = await fetch(`/api/journey-builder/${journeySessionId}/complete-step`, {
          method: 'POST',
          headers: complHeaders,
          body: JSON.stringify({
            stepId: journeyData?.journey?.steps?.[currentStepIndex]?.id,
            result: { understandingId, sessionId }
          })
        });

        if (!completeResponse.ok) {
          throw new Error('Failed to complete journey step');
        }

        stepCompletion = await completeResponse.json();
      }

      clearInterval(progressInterval);
      setProgress(100);

      // Check if journey is complete or if there are more steps
      if (stepCompletion?.completed) {
        // Journey complete - navigate to classification
        setTimeout(() => {
          try { sessionStorage.removeItem('strategic-input-draft'); } catch {}
          setLocation(`/strategic-consultant/classification/${understandingId}`);
        }, 300);
      } else {
        // More steps remaining - refetch journey and clear input for next step
        await refetchJourney();
        setText(''); // Clear input for next step
        
        toast({
          title: "Step completed",
          description: `Moving to step ${(stepCompletion?.nextStepIndex || 0) + 1}...`,
        });
      }

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

        {/* Clarification Modal for Journey Mode */}
        {showClarificationModal && (
          <ClarificationModal
            questions={clarificationQuestions}
            onSubmit={handleJourneyClarificationsSubmit}
            onSkip={handleJourneySkipClarifications}
          />
        )}
      </AppLayout>
    );
  }

  // Normal Mode UI (original flow)
  return (
    <AppLayout
      title="Strategic Consultant Agent"
      subtitle="Transform executive input into AI-analyzed strategic decisions"
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
                <Label htmlFor="text-input">
                  Text Input
                  {isLoadingSummary && (
                    <span className="ml-2 text-muted-foreground text-sm">
                      <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                      Loading segment discovery context...
                    </span>
                  )}
                  {discoveryId && !isLoadingSummary && text && (
                    <Badge variant="secondary" className="ml-2">
                      From Segment Discovery
                    </Badge>
                  )}
                </Label>
                <Textarea
                  id="text-input"
                  data-testid="input-strategic-text"
                  placeholder={isLoadingSummary 
                    ? "Loading your segment discovery insights..." 
                    : "e.g., Our SaaS company needs to expand into enterprise markets. Current revenue is $10M ARR from SMB customers. We need to decide on enterprise features, sales strategy, and architecture..."}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  disabled={isAnalyzing || isLoadingSummary}
                  className="resize-none"
                />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label>Budget Constraint (Optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Leave empty for cost discovery mode. Set budget/timeline to enforce constraints.
                  </p>
                </div>

                <RadioGroup
                  value={budgetMode}
                  onValueChange={(value) => setBudgetMode(value as 'none' | 'set')}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="budget-mode-none" data-testid="radio-budget-none" />
                    <Label htmlFor="budget-mode-none" className="font-normal">
                      No - Help me discover costs
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="set" id="budget-mode-set" data-testid="radio-budget-set" />
                    <Label htmlFor="budget-mode-set" className="font-normal">
                      Yes - I have budget constraints
                    </Label>
                  </div>
                </RadioGroup>

                {budgetMode === 'set' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="budget-amount-input">Budget (USD)</Label>
                      <Input
                        id="budget-amount-input"
                        data-testid="input-budget-amount"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        placeholder="1800000"
                        value={budgetAmount}
                        onChange={(e) => setBudgetAmount(e.target.value)}
                        disabled={isAnalyzing || isLoadingSummary}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="budget-timeline-input">Timeline (months)</Label>
                      <Input
                        id="budget-timeline-input"
                        data-testid="input-budget-timeline"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        placeholder="24"
                        value={budgetTimelineMonths}
                        onChange={(e) => setBudgetTimelineMonths(e.target.value)}
                        disabled={isAnalyzing || isLoadingSummary}
                      />
                    </div>
                  </div>
                )}
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
                disabled={isAnalyzing || isCheckingAmbiguities || (!text.trim() && !file) || !!uploadError}
                data-testid="button-analyze"
              >
                {isCheckingAmbiguities ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking for ambiguities...
                  </>
                ) : isAnalyzing ? (
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

      {/* Clarification Modal */}
      {showClarificationModal && (
        <ClarificationModal
          questions={clarificationQuestions}
          onSubmit={journeySessionId ? handleJourneyClarificationsSubmit : handleClarificationsSubmit}
          onSkip={journeySessionId ? handleJourneySkipClarifications : handleSkipClarifications}
        />
      )}
    </AppLayout>
  );
}
