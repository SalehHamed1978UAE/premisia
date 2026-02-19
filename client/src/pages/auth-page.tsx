import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, Mail, AlertCircle } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import logoLight from "@assets/Untitled (3600 x 1000 px)_1762102046406.png";
import logoDark from "@assets/Untitled (3600 x 1000 px)-modified_1762102046405.png";

export default function AuthPage() {
  const { user, isLoading, loginWithGoogle, loginWithEmail, signUpWithEmail, sendMagicLink, authConfigError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google");
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password);
      setSuccess("Account created! Please check your email to verify your account.");
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await sendMagicLink(email);
      setSuccess("Magic link sent! Please check your email.");
      setShowMagicLink(false);
    } catch (err: any) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 p-12 flex-col justify-between text-white">
        <div>
          <div className="flex items-center space-x-3 mb-8">
            <img src={logoDark} alt="Premisia Logo" className="h-10 w-auto" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
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
          &copy; 2025 Premisia. All rights reserved.
        </div>
      </div>

      {/* Auth Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-card/50 backdrop-blur">
            <CardHeader className="text-center">
              <div className="flex flex-col items-center gap-3 mb-2">
                <img src={logoLight} alt="Premisia Logo" className="h-12 w-auto dark:hidden" />
                <img src={logoDark} alt="Premisia Logo" className="h-12 w-auto hidden dark:block" />
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl md:text-3xl font-bold">Welcome to Premisia</CardTitle>
                  <span className="px-2 py-1 text-xs font-semibold bg-primary/10 text-primary rounded">BETA</span>
                </div>
              </div>
              <CardDescription>Think it through</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {authConfigError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{authConfigError}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
                </Alert>
              )}

              <Button onClick={handleGoogleSignIn} disabled={isSubmitting || !!authConfigError} className="w-full h-12 text-base font-medium" size="lg">
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <SiGoogle className="mr-2 h-5 w-5" />}
                Sign in with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {!showMagicLink ? (
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Create Account</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin" className="space-y-4">
                    <form onSubmit={handleEmailSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Email</Label>
                        <Input id="signin-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting || !!authConfigError} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Password</Label>
                        <Input id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isSubmitting || !!authConfigError} />
                      </div>
                      <Button type="submit" className="w-full" disabled={isSubmitting || !!authConfigError}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Sign In
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    <form onSubmit={handleEmailSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input id="signup-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting || !!authConfigError} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input id="signup-password" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isSubmitting || !!authConfigError} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input id="confirm-password" type="password" placeholder="Re-enter your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isSubmitting || !!authConfigError} />
                      </div>
                      <Button type="submit" className="w-full" disabled={isSubmitting || !!authConfigError}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create Account
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        By creating an account, you'll receive a verification email to confirm your address
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="magic-email">Email</Label>
                    <Input id="magic-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting || !!authConfigError} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting || !!authConfigError}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Send Login Link
                  </Button>
                  <button type="button" onClick={() => setShowMagicLink(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center">
                    Back to email/password
                  </button>
                </form>
              )}

              {!showMagicLink && (
                <button onClick={() => setShowMagicLink(true)} className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center">
                  Email me a login link instead
                </button>
              )}

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="text-sm font-semibold text-foreground mb-2">Secure Authentication</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Google OAuth 2.0 / PKCE authentication</p>
                  <p>Email verification for new accounts</p>
                  <p>Secure magic link authentication</p>
                  <p>Your data is encrypted and protected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
