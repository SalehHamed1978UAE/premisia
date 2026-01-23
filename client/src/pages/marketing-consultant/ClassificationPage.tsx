import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Info, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppLayout } from '@/components/layout/AppLayout';
import { apiRequest } from '@/lib/queryClient';

const OFFERING_TYPES = [
  { value: 'b2b_software', label: 'B2B Software', description: 'Software sold to businesses' },
  { value: 'b2c_software', label: 'B2C Software', description: 'Software sold directly to consumers' },
  { value: 'professional_services', label: 'Professional Services', description: 'Consulting, agencies, or service-based businesses' },
  { value: 'physical_product', label: 'Physical Product', description: 'Tangible goods sold to customers' },
  { value: 'marketplace_platform', label: 'Marketplace/Platform', description: 'Two-sided marketplaces connecting buyers and sellers' },
  { value: 'content_education', label: 'Content/Education', description: 'Courses, content, or educational products' },
  { value: 'other', label: 'Other', description: 'Other types of offerings' },
];

const COMPANY_STAGES = [
  { value: 'idea_stage', label: 'Idea Stage', description: 'Just an idea, no product yet' },
  { value: 'built_no_users', label: 'Built, No Users', description: 'Product built but no users yet' },
  { value: 'early_users', label: 'Early Users', description: 'Have some initial users or customers' },
  { value: 'growing', label: 'Growing', description: 'Established with growing user base' },
  { value: 'scaling', label: 'Scaling', description: 'Actively scaling operations' },
];

const GTM_CONSTRAINTS = [
  { value: 'solo_founder', label: 'Solo Founder', description: 'One person doing everything' },
  { value: 'small_team', label: 'Small Team', description: 'Small team with limited resources' },
  { value: 'funded_startup', label: 'Funded Startup', description: 'Have raised funding, building team' },
  { value: 'established_company', label: 'Established Company', description: 'Established company with resources' },
];

const SALES_MOTIONS = [
  { value: 'self_serve', label: 'Self-Serve', description: 'Users sign up and buy on their own' },
  { value: 'light_touch', label: 'Light Touch', description: 'Some sales involvement, mostly self-serve' },
  { value: 'enterprise', label: 'Enterprise', description: 'High-touch sales process' },
  { value: 'partner_channel', label: 'Partner/Channel', description: 'Sell through partners or resellers' },
];

const classificationSchema = z.object({
  offeringType: z.string().min(1, 'Please select an offering type'),
  companyStage: z.string().min(1, 'Please select a company stage'),
  gtmConstraint: z.string().min(1, 'Please select a GTM constraint'),
  salesMotion: z.string().min(1, 'Please select a sales motion'),
  existingCustomerHypothesis: z.string().optional(),
});

type ClassificationFormData = z.infer<typeof classificationSchema>;

interface MarketingUnderstanding {
  id: string;
  offeringDescription?: string;
  offeringType?: string;
  stage?: string;
  gtmConstraint?: string;
  salesMotion?: string;
  existingHypothesis?: string;
  clarifications?: string;
  status?: string;
  classificationConfidence?: number;
}

export default function MarketingClassificationPage() {
  const { understandingId } = useParams<{ understandingId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: understanding, isLoading, error } = useQuery<MarketingUnderstanding>({
    queryKey: ['/api/marketing-consultant', understandingId],
    enabled: !!understandingId,
  });

  const form = useForm<ClassificationFormData>({
    resolver: zodResolver(classificationSchema),
    defaultValues: {
      offeringType: '',
      companyStage: '',
      gtmConstraint: '',
      salesMotion: '',
      existingCustomerHypothesis: '',
    },
  });

  useEffect(() => {
    if (understanding) {
      form.reset({
        offeringType: understanding.offeringType || '',
        companyStage: understanding.stage || '',
        gtmConstraint: understanding.gtmConstraint || '',
        salesMotion: understanding.salesMotion || '',
        existingCustomerHypothesis: understanding.existingHypothesis || '',
      });
    }
  }, [understanding, form]);

  const confirmMutation = useMutation({
    mutationFn: async (data: ClassificationFormData) => {
      const response = await apiRequest('POST', '/api/marketing-consultant/classification/confirm', {
        understandingId,
        offeringType: data.offeringType,
        stage: data.companyStage,
        gtmConstraint: data.gtmConstraint,
        salesMotion: data.salesMotion,
        existingHypothesis: data.existingCustomerHypothesis || null,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Classification confirmed',
        description: 'Your classification has been saved. Starting segment discovery...',
      });
      setTimeout(() => {
        setLocation(`/marketing-consultant/journey-selection/${understandingId}`);
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to confirm classification',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ClassificationFormData) => {
    confirmMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <AppLayout title="Classification" subtitle="Loading...">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading classification...</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (error || !understanding) {
    return (
      <AppLayout title="Classification" subtitle="Error loading">
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
              onClick={() => setLocation('/marketing-consultant/input')}
              data-testid="button-back-to-input"
            >
              Back to Input
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const confidencePercentage = understanding.classificationConfidence 
    ? Math.round(understanding.classificationConfidence * 100) 
    : null;
  const confidenceColor = confidencePercentage 
    ? (confidencePercentage >= 80 ? 'text-green-600' : 
       confidencePercentage >= 60 ? 'text-yellow-600' : 'text-orange-600')
    : 'text-muted-foreground';

  return (
    <AppLayout title="Confirm Classification" subtitle="Review and confirm the AI-detected classification">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">AI Classification</CardTitle>
                <CardDescription className="mt-2">
                  We've analyzed your offering. Please confirm or correct the classification below.
                </CardDescription>
              </div>
              {confidencePercentage !== null && (
                <Badge 
                  variant="outline" 
                  className={`${confidenceColor} border-current`}
                  data-testid="badge-confidence"
                >
                  {confidencePercentage}% confidence
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="offeringType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offering Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-offering-type">
                            <SelectValue placeholder="Select your offering type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-900 text-white border border-slate-700">
                          {OFFERING_TYPES.map((type) => (
                            <SelectItem 
                              key={type.value} 
                              value={type.value}
                              data-testid={`select-option-offering-${type.value}`}
                            >
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <FormDescription>
                          {OFFERING_TYPES.find(t => t.value === field.value)?.description}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companyStage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company-stage">
                            <SelectValue placeholder="Select your company stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-900 text-white border border-slate-700">
                          {COMPANY_STAGES.map((stage) => (
                            <SelectItem 
                              key={stage.value} 
                              value={stage.value}
                              data-testid={`select-option-stage-${stage.value}`}
                            >
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <FormDescription>
                          {COMPANY_STAGES.find(s => s.value === field.value)?.description}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gtmConstraint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Go-to-Market Constraint</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-gtm-constraint">
                            <SelectValue placeholder="Select your GTM constraint" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-900 text-white border border-slate-700">
                          {GTM_CONSTRAINTS.map((constraint) => (
                            <SelectItem 
                              key={constraint.value} 
                              value={constraint.value}
                              data-testid={`select-option-gtm-${constraint.value}`}
                            >
                              {constraint.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <FormDescription>
                          {GTM_CONSTRAINTS.find(c => c.value === field.value)?.description}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="salesMotion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Motion</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-sales-motion">
                            <SelectValue placeholder="Select your sales motion" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-900 text-white border border-slate-700">
                          {SALES_MOTIONS.map((motion) => (
                            <SelectItem 
                              key={motion.value} 
                              value={motion.value}
                              data-testid={`select-option-sales-${motion.value}`}
                            >
                              {motion.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <FormDescription>
                          {SALES_MOTIONS.find(m => m.value === field.value)?.description}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="existingCustomerHypothesis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Existing Customer Hypothesis (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe who you think your ideal customers are, if you have any ideas..."
                          className="resize-none"
                          rows={4}
                          data-testid="textarea-customer-hypothesis"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Share any existing thoughts about your target customers. This helps guide the segment discovery.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={confirmMutation.isPending}
                  className="w-full font-semibold text-base shadow-md hover:shadow-lg"
                  size="lg"
                  data-testid="button-confirm-classification"
                >
                  {confirmMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Confirm and Start Segment Discovery
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Why does this matter?</strong> Your classification helps our AI 
                  identify the most relevant customer segments for your specific type of 
                  offering, stage, and go-to-market approach.
                </p>
                <p>
                  If the AI got something wrong, please correct it. Accurate classification 
                  leads to better segment recommendations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
