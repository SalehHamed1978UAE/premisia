import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Archive, FileText, ArrowRight, CheckCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: "Strategic Consultant",
    icon: Sparkles,
    description: "Turn your business ideas into actionable strategies",
    features: [
      "Share your strategic challenge or business idea",
      "AI analyzes using frameworks like Business Model Canvas, Porter's Five Forces",
      "Get evidence-based strategic decisions with supporting rationale",
      "Interactive exploration with Five Whys analysis"
    ],
    color: "from-blue-500 to-blue-600",
    path: "/strategic-consultant/input"
  },
  {
    id: 2,
    title: "Analysis Repository",
    icon: Archive,
    description: "Browse and explore all your strategic analyses",
    features: [
      "Access all your completed strategic analyses",
      "View framework-specific insights (BMC, Porter's, PESTLE)",
      "Compare different versions of your strategy",
      "Export and share your strategic findings"
    ],
    color: "from-purple-500 to-purple-600",
    path: "/repository"
  },
  {
    id: 3,
    title: "EPM Programs",
    icon: FileText,
    description: "Convert strategies into executable programs",
    features: [
      "AI generates complete 14-component EPM programs",
      "Interactive Gantt charts with dependencies",
      "Workstreams, milestones, and deliverables",
      "Risk registers, resource plans, and financial tracking"
    ],
    color: "from-green-500 to-green-600",
    path: "/strategy-workspace/programs"
  }
];

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    setLocation('/strategic-consultant/input');
  };

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const Icon = currentStepData.icon;

  return (
    <AppLayout showTopBar={false}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl mb-6 shadow-lg">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Welcome to Qgentic EPM
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Turn strategic ideas into executable enterprise programs with AI-powered guidance
            </p>
          </div>

          {/* Step Indicators */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              {ONBOARDING_STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(index)}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                      index === currentStep
                        ? "bg-primary text-primary-foreground shadow-lg scale-110"
                        : index < currentStep
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                    data-testid={`step-indicator-${index}`}
                  >
                    {index < currentStep ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      step.id
                    )}
                  </button>
                  {index < ONBOARDING_STEPS.length - 1 && (
                    <div className={cn(
                      "w-16 h-1 mx-2 transition-all",
                      index < currentStep ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <Card className="max-w-4xl mx-auto shadow-xl">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Icon & Title */}
                <div className="flex-shrink-0">
                  <div className={cn(
                    "w-24 h-24 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                    currentStepData.color
                  )}>
                    <Icon className="h-12 w-12 text-white" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                    </span>
                  </div>
                  <h2 className="text-3xl font-bold text-foreground mb-3">
                    {currentStepData.title}
                  </h2>
                  <p className="text-lg text-muted-foreground mb-6">
                    {currentStepData.description}
                  </p>

                  {/* Features List */}
                  <div className="space-y-3 mb-8">
                    {currentStepData.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                          <CheckCircle className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-foreground">{feature}</p>
                      </div>
                    ))}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-4">
                    {currentStep > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(currentStep - 1)}
                        data-testid="button-previous"
                      >
                        Previous
                      </Button>
                    )}
                    
                    {currentStep < ONBOARDING_STEPS.length - 1 ? (
                      <Button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        className="ml-auto"
                        data-testid="button-next"
                      >
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleGetStarted}
                        className="ml-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                        size="lg"
                        data-testid="button-get-started"
                      >
                        <Sparkles className="mr-2 h-5 w-5" />
                        Try It Now - Strategic Consultant
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Access Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
            {ONBOARDING_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <Card
                  key={step.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-lg",
                    index === currentStep && "ring-2 ring-primary"
                  )}
                  onClick={() => setCurrentStep(index)}
                  data-testid={`quick-access-${index}`}
                >
                  <CardContent className="p-6">
                    <div className={cn(
                      "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4",
                      step.color
                    )}>
                      <StepIcon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
