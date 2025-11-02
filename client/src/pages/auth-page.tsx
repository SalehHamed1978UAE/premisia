import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import logoLight from "@assets/PREMISIA Think it through (1)-modified_1762085311768.png";
import logoDark from "@assets/PREMISIA Think it through (1)_1762085311768.png";

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
            <img 
              src={logoDark} 
              alt="Premisia Logo" 
              className="h-10 w-auto"
            />
            <span className="px-2 py-0.5 text-xs font-semibold bg-white/20 rounded">BETA</span>
          </div>
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                From strategic question to execution-ready program—fast
              </h2>
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                Premisia structures complex choices so leaders can align, commit, and move. Multi-agent AI that turns leadership intent into EPM-grade roadmaps, budgets, and OKRs—with live evidence, governance, and change tracking.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 mt-12">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Multi-Agent AI System</span>
                </div>
                <p className="text-sm text-primary-foreground/70 ml-7">
                  Not a chatbot—specialized agents for strategy, building, and QA
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Hours, Not Weeks</span>
                </div>
                <p className="text-sm text-primary-foreground/70 ml-7">
                  Compress strategy work from weeks to hours—with on-call agents for scenarios
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Evidence You Can Audit</span>
                </div>
                <p className="text-sm text-primary-foreground/70 ml-7">
                  Every recommendation carries sources, bias-checks, and assumptions
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Execution-Ready, Not Just Ideas</span>
                </div>
                <p className="text-sm text-primary-foreground/70 ml-7">
                  EPM-structured outputs: charter, milestones, costs, KPIs, RAID, RACI
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="text-sm text-primary-foreground/60">
          © 2025 Premisia. All rights reserved.
        </div>
      </div>

      {/* Auth Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-12">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-card/50 backdrop-blur">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="flex flex-col items-center gap-3 mb-2">
                  <img 
                    src={logoLight} 
                    alt="Premisia Logo" 
                    className="h-12 w-auto dark:hidden"
                  />
                  <img 
                    src={logoDark} 
                    alt="Premisia Logo" 
                    className="h-12 w-auto hidden dark:block"
                  />
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">Welcome to Premisia</h2>
                    <span className="px-2 py-1 text-xs font-semibold bg-primary/10 text-primary rounded">BETA</span>
                  </div>
                </div>
                <p className="text-muted-foreground">Think it through</p>
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
