import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import { SiGoogle } from "react-icons/si";

export default function AuthPage() {
  const { user, isLoading } = useAuth();

  if (user && !isLoading) {
    return <Redirect to="/" />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 p-12 flex-col justify-between text-white">
        <div>
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Qgentic EPM</h1>
              <p className="text-primary-foreground/80">Intelligent Strategic EPM</p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h2 className="text-4xl font-bold mb-4">
                Manage Complex Programs with Confidence
              </h2>
              <p className="text-xl text-primary-foreground/90 leading-relaxed">
                Track timelines, manage risks, monitor KPIs, and realize benefits across your enterprise transformation initiatives.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-12">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Timeline Management</span>
                </div>
                <p className="text-sm text-primary-foreground/70 ml-7">
                  Gantt charts, dependencies, and milestone tracking
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Risk Register</span>
                </div>
                <p className="text-sm text-primary-foreground/70 ml-7">
                  Comprehensive risk assessment and mitigation planning
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">KPI Tracking</span>
                </div>
                <p className="text-sm text-primary-foreground/70 ml-7">
                  Real-time performance metrics and trend analysis
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Benefits Realization</span>
                </div>
                <p className="text-sm text-primary-foreground/70 ml-7">
                  Track ROI and measure program success
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm text-primary-foreground/60">
          © 2024 Qgentic. All rights reserved.
        </div>
      </div>

      {/* Auth Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-12">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-card/50 backdrop-blur">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Welcome</h2>
                <p className="text-muted-foreground">Access your program management dashboard</p>
              </div>

              <div className="space-y-4">
                <Button 
                  onClick={() => window.location.href = '/api/login'}
                  className="w-full h-12 text-base"
                  data-testid="button-login"
                >
                  <SiGoogle className="mr-2 h-5 w-5" />
                  Sign in with Replit
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Secure authentication via Replit
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Easy Access</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>• Click "Sign in with Replit" to authenticate</p>
                    <p>• Supports Google login through Replit</p>
                    <p>• Secure OAuth 2.0 / OIDC authentication</p>
                    <p>• Perfect for sharing demos and collaborating</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
