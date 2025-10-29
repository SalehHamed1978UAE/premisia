import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Target, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Disabled: Using new onboarding flow on Home page instead
    // const hasSeenWelcome = localStorage.getItem("qgentic_welcome_seen");
    // if (!hasSeenWelcome) {
    //   setOpen(true);
    // }
  }, []);

  const handleGetStarted = () => {
    localStorage.setItem("qgentic_welcome_seen", "true");
    setOpen(false);
    setLocation("/strategic-consultant/input");
  };

  const handleClose = () => {
    localStorage.setItem("qgentic_welcome_seen", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="modal-welcome">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Welcome to QGentic!</DialogTitle>
              <DialogDescription className="text-base">
                AI-Enhanced Strategic Intelligence Platform
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <p className="text-muted-foreground">
            QGentic transforms your strategic ideas into complete, execution-ready EPM programs in 15-30 minutes—vs. weeks of traditional consulting.
          </p>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="mt-1 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-1">AI Strategic Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Share your business idea or strategy document. Claude Sonnet 4 analyzes it and generates actionable strategic decisions with supporting rationale.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="mt-1 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-1">Root Cause Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Use the Five Whys methodology to dig deep into challenges and identify true root causes with evidence-based insights.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="mt-1 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-1">Auto-Generate EPM Programs</h4>
                <p className="text-sm text-muted-foreground">
                  Convert your finalized strategy into complete program structures: workstreams, tasks, KPIs, risks, benefits, and resource plans.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm font-medium text-foreground mb-1">
              🚀 Ready to start?
            </p>
            <p className="text-sm text-muted-foreground">
              Click the <span className="font-semibold text-primary">Strategic Consultant</span> button in the sidebar to begin your first strategic analysis.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-skip-welcome"
          >
            I'll Explore Later
          </Button>
          <Button
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-primary to-primary/80 shadow-lg"
            data-testid="button-start-strategic-consultant"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Start Strategic Consultant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
