import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Rocket, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface JourneyLauncherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  understandingId: string;
  strategyTitle: string;
  contextMetrics: {
    entityCount: number;
    referenceCount: number;
    completedFrameworks: string[];
  };
}

interface JourneyDefinition {
  type: string;
  name: string;
  description: string;
  frameworks: string[];
  estimatedDuration: string;
  available: boolean;
}

interface FrameworkDefinition {
  id: string;
  name: string;
  description: string;
  available: boolean;
}

const JOURNEY_TYPES: JourneyDefinition[] = [
  {
    type: 'market_entry',
    name: 'Market Entry Strategy',
    description: 'Analyze market conditions, competitive forces, and business model for entering new markets',
    frameworks: ['five_whys', 'porters', 'bmc'],
    estimatedDuration: '15-20 minutes',
    available: true,
  },
  {
    type: 'business_model_innovation',
    name: 'Business Model Innovation',
    description: 'Design and validate innovative business models with root cause analysis and market research',
    frameworks: ['five_whys', 'bmc', 'pestle'],
    estimatedDuration: '15-20 minutes',
    available: true,
  },
  {
    type: 'competitive_strategy',
    name: 'Competitive Strategy',
    description: 'Assess competitive dynamics and develop differentiation strategies',
    frameworks: ['porters', 'pestle', 'bmc'],
    estimatedDuration: '15-20 minutes',
    available: true,
  },
  {
    type: 'digital_transformation',
    name: 'Digital Transformation',
    description: 'Plan technology-driven transformation with business model and trend analysis',
    frameworks: ['pestle', 'bmc', 'five_whys'],
    estimatedDuration: '15-20 minutes',
    available: true,
  },
  {
    type: 'crisis_recovery',
    name: 'Crisis Recovery',
    description: 'Identify root causes, assess external factors, and rebuild strategic foundations',
    frameworks: ['five_whys', 'pestle', 'porters'],
    estimatedDuration: '15-20 minutes',
    available: true,
  },
  {
    type: 'growth_strategy',
    name: 'Growth Strategy',
    description: 'Explore growth opportunities through comprehensive strategic analysis',
    frameworks: ['bmc', 'pestle', 'porters'],
    estimatedDuration: '15-20 minutes',
    available: true,
  },
];

const FRAMEWORKS: FrameworkDefinition[] = [
  {
    id: 'five_whys',
    name: "Five Whys Analysis",
    description: "Root cause analysis to uncover fundamental problems",
    available: true,
  },
  {
    id: 'bmc',
    name: "Business Model Canvas",
    description: "Comprehensive business model design and validation",
    available: true,
  },
  {
    id: 'porters',
    name: "Porter's Five Forces",
    description: "Competitive forces and industry structure analysis",
    available: true,
  },
  {
    id: 'pestle',
    name: "PESTLE Analysis",
    description: "External macro-environmental trends and factors",
    available: true,
  },
  {
    id: 'swot',
    name: "SWOT Analysis",
    description: "Strengths, weaknesses, opportunities, and threats",
    available: false,
  },
  {
    id: 'ansoff',
    name: "Ansoff Matrix",
    description: "Product and market growth strategies",
    available: false,
  },
  {
    id: 'blue_ocean',
    name: "Blue Ocean Strategy",
    description: "Value innovation and uncontested market spaces",
    available: false,
  },
];

export default function JourneyLauncherModal({
  open,
  onOpenChange,
  understandingId,
  strategyTitle,
  contextMetrics,
}: JourneyLauncherModalProps) {
  const [selectedJourney, setSelectedJourney] = useState<string | null>(null);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const { toast } = useToast();

  const handleJourneySelect = (journeyType: string) => {
    setSelectedJourney(journeyType);
    setSelectedFrameworks([]); // Clear framework selection when switching tabs
  };

  const handleFrameworkToggle = (frameworkId: string) => {
    setSelectedFrameworks(prev =>
      prev.includes(frameworkId)
        ? prev.filter(id => id !== frameworkId)
        : [...prev, frameworkId]
    );
  };

  const handleNavigateToJourney = () => {
    // Navigate to strategic consultant with preloaded context
    window.location.href = `/strategic-consultant/journey-selection/${understandingId}`;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Run Additional Analysis
          </DialogTitle>
          <DialogDescription>
            Continue analyzing <span className="font-semibold">{strategyTitle}</span> with full journeys or individual frameworks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Available Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">References:</span>{" "}
                  <span className="font-semibold">{contextMetrics.referenceCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Entities:</span>{" "}
                  <span className="font-semibold">{contextMetrics.entityCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>{" "}
                  <span className="font-semibold">{contextMetrics.completedFrameworks.length} frameworks</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Full Journey vs Single Framework */}
          <Tabs defaultValue="journey" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="journey" data-testid="tab-full-journey">Full Journey</TabsTrigger>
              <TabsTrigger value="framework" data-testid="tab-single-framework">Single Framework</TabsTrigger>
            </TabsList>

            {/* Full Journey Tab */}
            <TabsContent value="journey" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a comprehensive analysis journey that runs multiple frameworks in sequence
              </p>
              <div className="grid gap-3">
                {JOURNEY_TYPES.map(journey => (
                  <Card
                    key={journey.type}
                    className={`cursor-pointer transition-all ${
                      selectedJourney === journey.type
                        ? 'ring-2 ring-primary'
                        : 'hover:shadow-md'
                    } ${!journey.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => journey.available && handleJourneySelect(journey.type)}
                    data-testid={`card-journey-${journey.type}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{journey.name}</CardTitle>
                          <CardDescription className="mt-1 text-xs">
                            {journey.description}
                          </CardDescription>
                        </div>
                        {selectedJourney === journey.type && (
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {journey.estimatedDuration}
                        </Badge>
                        {journey.frameworks.map(fw => (
                          <Badge key={fw} variant="outline" className="text-xs capitalize">
                            {fw.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {!journey.available && (
                          <Badge variant="outline" className="text-xs">
                            Coming Soon
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedJourney && (
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button onClick={handleNavigateToJourney} data-testid="button-start-journey">
                    <Rocket className="h-4 w-4 mr-2" />
                    Start Journey
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Single Framework Tab */}
            <TabsContent value="framework" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select one or more individual frameworks to analyze specific aspects of your strategy
              </p>
              <div className="grid gap-3">
                {FRAMEWORKS.map(framework => (
                  <Card
                    key={framework.id}
                    className={`${
                      !framework.available ? 'opacity-50' : 'hover:shadow-sm'
                    } transition-shadow`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`framework-${framework.id}`}
                          checked={selectedFrameworks.includes(framework.id)}
                          onCheckedChange={() => framework.available && handleFrameworkToggle(framework.id)}
                          disabled={!framework.available}
                          data-testid={`checkbox-framework-${framework.id}`}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`framework-${framework.id}`}
                            className="text-base font-semibold cursor-pointer"
                          >
                            {framework.name}
                            {!framework.available && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Coming Soon
                              </Badge>
                            )}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {framework.description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {selectedFrameworks.length > 0 && (
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-framework">
                    Cancel
                  </Button>
                  <Button onClick={handleNavigateToJourney} data-testid="button-run-frameworks">
                    <Rocket className="h-4 w-4 mr-2" />
                    Run {selectedFrameworks.length} Framework{selectedFrameworks.length > 1 ? 's' : ''}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}