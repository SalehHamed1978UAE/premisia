import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { FrameworkSelection, type FrameworkSelectionData } from '@/components/strategic-consultant/FrameworkSelection';
import { BMCCanvas, type BMCAnalysis } from '@/components/strategic-consultant/BMCCanvas';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function BMCTestPage() {
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => `test-${Date.now()}`);
  const [frameworkSelection, setFrameworkSelection] = useState<FrameworkSelectionData | null>(null);
  const [bmcAnalysis, setBmcAnalysis] = useState<BMCAnalysis | null>(null);
  const [isSelectingFramework, setIsSelectingFramework] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
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
    if (!frameworkSelection || frameworkSelection.selectedFramework !== 'business_model_canvas') {
      toast({
        title: 'BMC Not Selected',
        description: 'Business Model Canvas must be selected first',
        variant: 'destructive',
      });
      return;
    }

    setIsResearching(true);
    
    try {
      const response = await apiRequest('POST', '/api/strategic-consultant/bmc-research', { input, sessionId, versionNumber: 1 });

      const data = await response.json();
      setBmcAnalysis(data.result);

      toast({
        title: 'Research Complete',
        description: `Analyzed ${data.result.blocks.length} BMC blocks`,
      });
    } catch (error: any) {
      toast({
        title: 'Research Failed',
        description: error.message || 'Failed to conduct BMC research',
        variant: 'destructive',
      });
    } finally {
      setIsResearching(false);
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
              disabled={isSelectingFramework || !input.trim()}
              className="w-full"
            >
              {isSelectingFramework ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Query...
                </>
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
            <CardContent>
              <FrameworkSelection
                selection={frameworkSelection}
                onConfirm={handleConfirmFramework}
                onOverride={handleOverrideFramework}
              />
              
              {frameworkSelection.selectedFramework === 'business_model_canvas' && (
                <div className="mt-4">
                  <Button
                    data-testid="button-conduct-bmc-research"
                    onClick={handleConductBMCResearch}
                    disabled={isResearching}
                    className="w-full"
                  >
                    {isResearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Conducting BMC Research...
                      </>
                    ) : (
                      'Conduct BMC Research'
                    )}
                  </Button>
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
