import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Lightbulb, ArrowRight, Check, AlertCircle, Zap, Loader2 } from 'lucide-react';

interface Framework {
  id: string;
  frameworkKey: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface JourneyBuilderWizardProps {
  onClose: () => void;
  onSave: () => void;
}

export function JourneyBuilderWizard({ onClose, onSave }: JourneyBuilderWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [journeyName, setJourneyName] = useState('');
  const [journeyDescription, setJourneyDescription] = useState('');
  const [userGoal, setUserGoal] = useState('');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);

  // Fetch available frameworks
  const { data, isLoading: loadingFrameworks } = useQuery({
    queryKey: ['frameworks'],
    queryFn: async () => {
      const res = await fetch('/api/journey-builder/frameworks');
      if (!res.ok) throw new Error('Failed to fetch frameworks');
      const json = await res.json();
      return json.frameworks as Framework[];
    },
  });

  const frameworks = data || [];

  // Analyze journey mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const steps = selectedFrameworks.map(fk => {
        const fw = frameworks.find(f => f.frameworkKey === fk);
        return { frameworkKey: fk, name: fw?.name || fk };
      });

      const res = await fetch('/api/journey-builder/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps, userGoal }),
      });

      if (!res.ok) throw new Error('Failed to analyze journey');
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setStep(3);
    },
  });

  // Save journey mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const steps = selectedFrameworks.map((fk, idx) => {
        const fw = frameworks.find(f => f.frameworkKey === fk);
        return {
          id: fk,
          frameworkKey: fk,
          name: fw?.name || fk,
          description: fw?.description,
          required: true,
          skippable: false,
          order: idx + 1,
          estimatedDuration: fw?.estimatedDuration || 5,
          dependsOn: idx > 0 ? [selectedFrameworks[idx - 1]] : [],
        };
      });

      const res = await fetch('/api/journey-builder/journeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: journeyName,
          description: journeyDescription,
          steps,
          tags: ['custom'],
        }),
      });

      if (!res.ok) throw new Error('Failed to save journey');
      return res.json();
    },
    onSuccess: () => {
      onSave();
    },
  });

  const toggleFramework = (frameworkKey: string) => {
    setSelectedFrameworks(prev =>
      prev.includes(frameworkKey)
        ? prev.filter(fk => fk !== frameworkKey)
        : [...prev, frameworkKey]
    );
  };

  const getCategoryColor = (category: string) => {
    const cat = category?.toLowerCase() || '';
    switch (cat) {
      case 'foundation': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'problem analysis': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'business model': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'competition': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'external environment': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'strategic position': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'decision making': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create Custom Journey</DialogTitle>
          <DialogDescription>
            Build your own strategic journey by selecting frameworks
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
            {step > 1 ? <Check className="w-5 h-5" /> : '1'}
          </div>
          <div className={`h-1 w-12 ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
            {step > 2 ? <Check className="w-5 h-5" /> : '2'}
          </div>
          <div className={`h-1 w-12 ${step >= 3 ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
            {step > 3 ? <Check className="w-5 h-5" /> : '3'}
          </div>
        </div>

        {/* Step 1: Name & Goal */}
        {step === 1 && (
          <div className="space-y-6 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Journey Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={journeyName}
                onChange={(e) => setJourneyName(e.target.value)}
                placeholder="e.g., Market Entry with Competitive Analysis"
                className="w-full"
                data-testid="input-journey-name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description (optional)
              </label>
              <Textarea
                value={journeyDescription}
                onChange={(e) => setJourneyDescription(e.target.value)}
                placeholder="What is this journey for?"
                rows={3}
                className="w-full"
                data-testid="input-journey-description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                What do you want to achieve? (optional)
              </label>
              <Textarea
                value={userGoal}
                onChange={(e) => setUserGoal(e.target.value)}
                placeholder="e.g., I want to enter a new market and understand the competitive landscape"
                rows={3}
                className="w-full"
                data-testid="input-user-goal"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!journeyName.trim()}
                className="gap-2"
                data-testid="button-next-step1"
              >
                Next: Select Frameworks
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Frameworks */}
        {step === 2 && (
          <div className="space-y-6 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Tip: Start with Strategic Understanding</p>
                <p>Most journeys begin with building strategic context before diving into specific frameworks.</p>
              </div>
            </div>

            {loadingFrameworks ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-sm text-muted-foreground">Loading frameworks...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {frameworks.map(fw => (
                  <Card
                    key={fw.id}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedFrameworks.includes(fw.frameworkKey)
                        ? 'border-2 border-purple-600 bg-purple-50'
                        : 'hover:border-gray-400'
                    }`}
                    onClick={() => toggleFramework(fw.frameworkKey)}
                    data-testid={`card-framework-${fw.frameworkKey}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedFrameworks.includes(fw.frameworkKey)}
                        onCheckedChange={() => toggleFramework(fw.frameworkKey)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{fw.name}</h3>
                          <Badge variant="secondary" className={`text-xs ${getCategoryColor(fw.category)}`}>
                            {fw.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            ~{fw.estimatedDuration} min
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {fw.description}
                        </p>
                      </div>
                      {selectedFrameworks.includes(fw.frameworkKey) && (
                        <div className="flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-xs font-medium">
                          {selectedFrameworks.indexOf(fw.frameworkKey) + 1}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back-step2">
                Back
              </Button>
              <Button
                onClick={() => analyzeMutation.mutate()}
                disabled={selectedFrameworks.length === 0 || analyzeMutation.isPending}
                className="gap-2"
                data-testid="button-analyze"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Get AI Recommendation
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: AI Analysis & Save */}
        {step === 3 && analysis && (
          <div className="space-y-6 py-4">
            {/* Validation Status */}
            <div className={`border rounded-lg p-4 ${
              analysis.validation.hasRequiredInfo 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                {analysis.validation.hasRequiredInfo ? (
                  <>
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-green-900">Ready to Produce Complete EPM</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-900">Missing Critical Information</span>
                  </>
                )}
              </h3>
              {analysis.validation.warnings.length > 0 && (
                <div className="space-y-1 mt-2">
                  {analysis.validation.warnings.map((warning: string, idx: number) => (
                    <p key={idx} className="text-sm text-yellow-800">{warning}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Information Collected */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Knowledge Graph Entities
              </h3>
              <p className="text-sm text-blue-800 mb-3">
                Your journey will collect these knowledge graph entities:
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.validation.informationCollected.map((info: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-800">
                    {info}
                  </Badge>
                ))}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">
                AI Analysis
              </h3>
              <p className="text-sm text-green-800 mb-4">
                {analysis.recommendation}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <h4 className="font-medium text-sm text-green-900 mb-2">
                    ✅ Suitable For:
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    {analysis.suitableFor.map((item: string, idx: number) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-green-900 mb-2">
                    💪 Strengths:
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    {analysis.strengths.map((item: string, idx: number) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {analysis.validation.recommendations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-200">
                  <h4 className="font-medium text-sm text-green-900 mb-2">
                    💡 Additional Recommendations:
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    {analysis.validation.recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-green-200">
                <p className="text-sm text-green-800">
                  <strong>Estimated Duration:</strong> ~{analysis.estimatedDuration} minutes
                </p>
              </div>
            </div>

            {/* Potential Gaps */}
            {analysis.potentialGaps && analysis.potentialGaps.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-900 mb-2">
                  ⚠️ Potential Gaps:
                </h3>
                <ul className="text-sm text-orange-800 space-y-1">
                  {analysis.potentialGaps.map((gap: string, idx: number) => (
                    <li key={idx}>• {gap}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} data-testid="button-back-step3">
                Back to Edit
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
                data-testid="button-save-journey"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Custom Journey
                    <Check className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
