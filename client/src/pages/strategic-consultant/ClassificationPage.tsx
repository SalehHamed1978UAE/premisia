import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ClassificationData {
  initiativeType: string;
  description: string;
  confidence: number;
  reasoning: string;
  userConfirmed: boolean;
}

const INITIATIVE_TYPE_LABELS: Record<string, string> = {
  physical_business_launch: 'Physical Business Launch',
  software_development: 'Software Development',
  digital_transformation: 'Digital Transformation',
  market_expansion: 'Market Expansion',
  product_launch: 'Product Launch',
  service_launch: 'Service Launch',
  process_improvement: 'Process Improvement',
  other: 'Other',
};

const INITIATIVE_TYPE_DESCRIPTIONS: Record<string, string> = {
  physical_business_launch: 'Opening physical locations such as stores, restaurants, offices, or warehouses',
  software_development: 'Building software products, apps, platforms, or technical systems',
  digital_transformation: 'Modernizing existing business with digital capabilities',
  market_expansion: 'Entering new markets, regions, or customer segments',
  product_launch: 'Introducing new physical or digital products',
  service_launch: 'Introducing new service offerings',
  process_improvement: 'Optimizing operations, workflows, or efficiency',
  other: 'General initiative that doesn\'t fit other categories',
};

export default function ClassificationPage() {
  const { understandingId } = useParams<{ understandingId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [classification, setClassification] = useState<ClassificationData | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    loadClassification();
  }, [understandingId]);

  const loadClassification = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/strategic-consultant/understanding/${understandingId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load classification');
      }
      
      const data = await response.json();
      
      const classificationData: ClassificationData = {
        initiativeType: data.initiativeType || 'other',
        description: data.initiativeDescription || 'Initiative classification',
        confidence: parseFloat(data.classificationConfidence || '0.5'),
        reasoning: '',
        userConfirmed: data.userConfirmed || false,
      };
      
      setClassification(classificationData);
      setSelectedType(classificationData.initiativeType);
    } catch (error: any) {
      console.error('Error loading classification:', error);
      toast({
        title: 'Failed to load classification',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    setHasChanged(newType !== classification?.initiativeType);
  };

  const handleConfirm = async () => {
    try {
      setIsUpdating(true);
      
      const response = await fetch('/api/strategic-consultant/classification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          understandingId,
          initiativeType: selectedType,
          userConfirmed: true,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update classification');
      }
      
      const result = await response.json();
      console.log('[ClassificationPage] Update successful:', result);
      
      toast({
        title: 'Classification confirmed',
        description: hasChanged 
          ? 'Your correction has been saved and will guide the analysis.'
          : 'Classification confirmed and saved.',
      });
      
      // Navigate to journey selection
      setTimeout(() => {
        setLocation(`/strategic-consultant/journey-selection/${understandingId}`);
      }, 500);
      
    } catch (error: any) {
      console.error('[ClassificationPage] Error updating classification:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading classification...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!classification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Classification data not found. Please try again.
            </AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation('/strategic-consultant/input')}
              data-testid="button-back-to-input"
            >
              Back to Input
            </Button>
            <Button
              onClick={loadClassification}
              data-testid="button-retry"
            >
              Retry Loading
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const confidencePercentage = Math.round(classification.confidence * 100);
  const confidenceColor = classification.confidence >= 0.8 ? 'text-green-600' : 
                          classification.confidence >= 0.6 ? 'text-yellow-600' : 
                          'text-orange-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Confirm Initiative Type
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our AI has analyzed your input and classified the type of initiative. 
            Please review and confirm or correct the classification.
          </p>
        </div>

        {/* AI Classification Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">AI Classification</CardTitle>
                <CardDescription className="mt-2">
                  {classification.description}
                </CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className={`${confidenceColor} border-current`}
                data-testid="badge-confidence"
              >
                {confidencePercentage}% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Classified Type Display */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground mb-2">Detected Initiative Type:</p>
              <p className="text-xl font-semibold text-primary" data-testid="text-detected-type">
                {INITIATIVE_TYPE_LABELS[classification.initiativeType]}
              </p>
            </div>

            {/* Low confidence warning */}
            {classification.confidence < 0.7 && (
              <Alert data-testid="alert-low-confidence">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  The AI has moderate confidence in this classification. 
                  Please review carefully and correct if needed.
                </AlertDescription>
              </Alert>
            )}

            {/* Selection */}
            <div className="space-y-3">
              <Label htmlFor="initiative-type" className="text-base font-medium">
                Confirm or Correct Initiative Type
              </Label>
              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger id="initiative-type" data-testid="select-initiative-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INITIATIVE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem 
                      key={value} 
                      value={value}
                      data-testid={`select-option-${value}`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {INITIATIVE_TYPE_DESCRIPTIONS[value]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Change indicator */}
            {hasChanged && (
              <Alert data-testid="alert-changed">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  You've changed the classification. This will help improve the accuracy 
                  of the strategic analysis.
                </AlertDescription>
              </Alert>
            )}

            {/* Confirm Button */}
            <Button
              onClick={handleConfirm}
              disabled={isUpdating}
              className="w-full"
              size="lg"
              data-testid="button-confirm"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Confirm and Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Why does this matter?</strong> The initiative type helps our AI 
                  provide more accurate strategic analysis, appropriate resource planning, 
                  and realistic timelines for your specific type of project.
                </p>
                <p>
                  If the AI got it wrong, please correct it. Your input helps the system 
                  learn and improve future classifications.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
