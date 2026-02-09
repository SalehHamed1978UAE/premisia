import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ExternalLink } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { FrameworkSelection, type FrameworkSelectionData } from '@/components/strategic-consultant/FrameworkSelection';
import { BMCCanvas, type BMCAnalysis } from '@/components/strategic-consultant/BMCCanvas';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function BMCTestPage() {
  const [, setLocation] = useLocation();
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => `test-${Date.now()}`);
  const [frameworkSelection, setFrameworkSelection] = useState<FrameworkSelectionData | null>(null);
  const [bmcAnalysis, setBmcAnalysis] = useState<BMCAnalysis | null>(null);
  const [isSelectingFramework, setIsSelectingFramework] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [researchCompleted, setResearchCompleted] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const { toast } = useToast();

  const handleSelectFramework = async () => {
    if (!input.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter your strategic query first',
        variant: 'destructive',
      });
      return;
    }

    setIsSelectingFramework(true);
    setBmcAnalysis(null);
    
    try {
      const response = await apiRequest('POST', '/api/strategic-consultant/select-framework', { input, sessionId });

      const data = await response.json();
      setFrameworkSelection(data.selection);

      toast({
        title: 'Framework Selected',
        description: `Selected: ${data.selection.selectedFramework.replace('_', ' ').toUpperCase()}`,
      });
    } catch (error: any) {
      toast({
        title: 'Selection Failed',
        description: error.message || 'Failed to select framework',
        variant: 'destructive',
      });
    } finally {
      setIsSelectingFramework(false);
    }
  };

  const handleConductBMCResearch = async () => {
    console.log('[BMC-FRONTEND] Button clicked!');
    
    if (!frameworkSelection || frameworkSelection.selectedFramework !== 'business_model_canvas') {
      console.log('[BMC-FRONTEND] Framework not BMC:', frameworkSelection);
      toast({
        title: 'BMC Not Selected',
        description: 'Business Model Canvas must be selected first',
        variant: 'destructive',
      });
      return;
    }

    console.log('[BMC-FRONTEND] Starting research, making fetch request...');
    setIsResearching(true);
    setResearchCompleted(false);
    setProgressMessage('Starting research...');
    setProgressStep(0);
    setProgressTotal(0);
    
    try {
      console.log('[BMC-FRONTEND] Fetching:', '/api/strategic-consultant/bmc-research');
      const response = await fetch('/api/strategic-consultant/bmc-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ input, sessionId, versionNumber: 1 }),
      });

      if (!response.ok) {
        throw new Error('Failed to start BMC research');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = ''; // Rolling buffer for partial lines

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // Decode chunk and append to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Split by newlines but keep last partial line in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            let data;
            try {
              data = JSON.parse(line.slice(6));
              console.log('[BMC-FRONTEND] Received SSE message:', data);
            } catch (parseError) {
              console.error('[BMC-FRONTEND] Failed to parse SSE message:', line, parseError);
              continue;
            }
            
            // Handle error events - propagate to outer catch
            if (data.error) {
              console.error('[BMC-FRONTEND] Error in SSE:', data.error);
              throw new Error(data.error);
            }
            
            // Handle completion
            if (data.complete) {
              console.log('[BMC-FRONTEND] Research complete! Setting researchCompleted=true', data.result);
              setBmcAnalysis(data.result);
              setProgressMessage('✅ Research complete!');
              setResearchCompleted(true);
              console.log('[BMC-FRONTEND] researchCompleted state should now be true');
              toast({
                title: 'Research Complete',
                description: `Analyzed ${data.result.blocks.length} BMC blocks. Results saved to database.`,
              });
            } 
            // Handle progress updates
            else if (data.message) {
              console.log('[BMC-FRONTEND] Updating progress:', data.message);
              setProgressMessage(data.message);
              if (data.step !== undefined) setProgressStep(data.step);
              if (data.totalSteps !== undefined) setProgressTotal(data.totalSteps);
            }
          }
        }
      }
    } catch (error: any) {
      setProgressMessage(''); // Clear on error
      toast({
        title: 'Research Failed',
        description: error.message || 'Failed to conduct BMC research',
        variant: 'destructive',
      });
    } finally {
      setIsResearching(false);
      // Don't clear progress message on success - keep "Research complete!" visible
    }
  };

  const handleOverrideFramework = (framework: 'business_model_canvas' | 'porters_five_forces' | 'user_choice') => {
    if (!frameworkSelection) return;

    setFrameworkSelection({
      ...frameworkSelection,
      selectedFramework: framework,
    });

    toast({
      title: 'Framework Overridden',
      description: `Switched to ${framework.replace('_', ' ').toUpperCase()}`,
    });
  };

  const handleConfirmFramework = () => {
    toast({
      title: 'Framework Confirmed',
      description: `Using ${frameworkSelection?.selectedFramework.replace('_', ' ').toUpperCase()}`,
    });
  };


  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">BMC Test Page</h1>
        <p className="text-muted-foreground">
          Test the Business Model Canvas framework selection and research pipeline
        </p>
      </div>

      <div className="grid gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>1. Enter Strategic Query</CardTitle>
            <CardDescription>
              Describe your strategic challenge or business question
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              data-testid="input-strategic-query"
              placeholder="Paste your strategic query here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={6}
              className="w-full"
            />

            <Button
              data-testid="button-select-framework"
              onClick={handleSelectFramework}
              disabled={isSelectingFramework || !input.trim() || !!frameworkSelection}
              className="w-full"
            >
              {isSelectingFramework ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Query...
                </>
              ) : frameworkSelection ? (
                'Framework Selected ✓'
              ) : (
                'Select Framework'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Framework Selection Display */}
        {frameworkSelection && (
          <Card>
            <CardHeader>
              <CardTitle>2. Framework Selection</CardTitle>
              <CardDescription>
                AI-powered routing between BMC and Porter's Five Forces
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FrameworkSelection
                selection={frameworkSelection}
                onConfirm={handleConfirmFramework}
                onOverride={handleOverrideFramework}
              />
              
              {frameworkSelection.selectedFramework === 'business_model_canvas' && (
                <div className="space-y-4">
                  <Button
                    data-testid="button-conduct-bmc-research"
                    onClick={handleConductBMCResearch}
                    disabled={isResearching}
                    className="w-full"
                    size="lg"
                  >
                    {isResearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Conducting BMC Research...
                      </>
                    ) : (
                      'Next: Conduct BMC Research →'
                    )}
                  </Button>

                  {progressMessage && (
                    <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        {isResearching ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                        ) : (
                          <span className="text-lg">✅</span>
                        )}
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {progressMessage}
                        </p>
                      </div>
                      {isResearching && progressTotal > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                            <span>Step {progressStep} of {progressTotal}</span>
                            <span>{Math.round((progressStep / progressTotal) * 100)}%</span>
                          </div>
                          <Progress 
                            value={(progressStep / progressTotal) * 100} 
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {researchCompleted && (
                    <Button
                      data-testid="button-view-results"
                      onClick={() => {
                        console.log('[BMC-FRONTEND] Navigating to results page:', `/bmc/results/${sessionId}/1`);
                        setLocation(`/bmc/results/${sessionId}/1`);
                      }}
                      className="w-full gap-2"
                      variant="outline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Saved Results & Download
                    </Button>
                  )}
                </div>
              )}
              
              {frameworkSelection.selectedFramework === 'porters_five_forces' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Porter's Five Forces was selected. Use the override button above to switch to Business Model Canvas if needed.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* BMC Canvas Display */}
        {bmcAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle>3. Business Model Canvas Analysis</CardTitle>
              <CardDescription>
                3-block analysis: Customer Segments, Value Propositions, Revenue Streams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BMCCanvas analysis={bmcAnalysis} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
