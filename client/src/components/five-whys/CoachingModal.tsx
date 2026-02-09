import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, AlertTriangle, Lightbulb, MessageCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface WhyIssue {
  type: 'causality' | 'relevance' | 'specificity' | 'evidence' | 'duplication' | 'contradiction' | 'circular';
  message: string;
  severity: 'critical' | 'warning';
}

interface WhyEvaluation {
  verdict: 'acceptable' | 'needs_clarification' | 'invalid';
  issues: WhyIssue[];
  followUpQuestions: string[];
  improvedSuggestion?: string;
  reasoning: string;
}

interface CoachingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluation: WhyEvaluation;
  candidate: string;
  rootQuestion: string;
  previousWhys: string[];
  sessionId: string;
  onRevise: (newAnswer: string, isCoachGenerated?: boolean) => void;
  onOverride: () => void;
}

export function CoachingModal({
  open,
  onOpenChange,
  evaluation,
  candidate,
  rootQuestion,
  previousWhys,
  sessionId,
  onRevise,
  onOverride,
}: CoachingModalProps) {
  // Pre-fill with AI's improved suggestion if available, otherwise use original
  const [revisedAnswer, setRevisedAnswer] = useState(evaluation.improvedSuggestion || candidate);
  const [coachingQuestion, setCoachingQuestion] = useState("");
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [coachingResponse, setCoachingResponse] = useState<string>("");
  // Track whether current answer is AI-generated (to bypass validation)
  const [isCurrentAnswerCoachGenerated, setIsCurrentAnswerCoachGenerated] = useState(!!evaluation.improvedSuggestion);

  const coachingMutation = useMutation({
    mutationFn: async (userQuestion: string) => {
      const response = await apiRequest(
        'POST',
        '/api/strategic-consultant/five-whys/coach',
        {
          sessionId,
          rootQuestion,
          previousWhys,
          candidate: revisedAnswer,
          userQuestion,
          conversationHistory,
        }
      );
      return await response.json() as { success: boolean; coaching: { guidance: string; suggestedRevision?: string } };
    },
    onSuccess: (data) => {
      if (data.success && data.coaching) {
        setCoachingResponse(data.coaching.guidance);
        setConversationHistory([
          ...conversationHistory,
          { role: 'user', content: coachingQuestion },
          { role: 'assistant', content: data.coaching.guidance },
        ]);
        if (data.coaching.suggestedRevision) {
          setRevisedAnswer(data.coaching.suggestedRevision);
          setIsCurrentAnswerCoachGenerated(true); // Mark as coach-generated
        }
        setCoachingQuestion("");
      }
    },
  });

  const handleAskCoach = () => {
    if (coachingQuestion.trim()) {
      coachingMutation.mutate(coachingQuestion);
    }
  };

  const handleAskFollowUp = (question: string) => {
    setCoachingQuestion(question);
    coachingMutation.mutate(question);
  };

  const handleUseImprovedSuggestion = () => {
    if (evaluation.improvedSuggestion) {
      // Directly submit the improved suggestion - mark as coach-generated
      onRevise(evaluation.improvedSuggestion, true);
    }
  };

  const handleGenerateNewSuggestion = () => {
    // Ask the coach to provide an alternative suggestion
    const question = "Can you provide a different way to phrase this answer? Give me an alternative suggestion.";
    coachingMutation.mutate(question);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRevisedAnswer(e.target.value);
    // User is manually editing - mark as NOT coach-generated
    setIsCurrentAnswerCoachGenerated(false);
  };

  const isInvalid = evaluation.verdict === 'invalid';
  const needsClarification = evaluation.verdict === 'needs_clarification';
  const criticalIssues = evaluation.issues.filter(i => i.severity === 'critical');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="coaching-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg md:text-xl">
            {isInvalid && <AlertCircle className="w-5 h-5 text-destructive shrink-0" />}
            {needsClarification && <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />}
            <span className="break-words">{isInvalid ? 'Let\'s Improve This Answer' : 'Consider Refining This'}</span>
          </DialogTitle>
          <DialogDescription className="text-sm md:text-base break-words">
            {isInvalid 
              ? 'This answer needs refinement before we can continue the analysis.'
              : 'This answer could be stronger. Let me help you think it through.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current Answer */}
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-2">Your current answer:</div>
              <p className="text-sm md:text-base font-medium break-words">{candidate}</p>
            </CardContent>
          </Card>

          {/* Issues */}
          {evaluation.issues.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                What to improve:
              </h3>
              <div className="space-y-3">
                {evaluation.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-3 md:p-4 rounded-lg border ${
                      issue.severity === 'critical'
                        ? 'bg-destructive/10 border-destructive/30'
                        : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                    }`}
                    data-testid={`issue-${idx}`}
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-2">
                      <Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'} className="shrink-0">
                        {issue.type}
                      </Badge>
                      <p className="text-sm break-words flex-1 leading-relaxed">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improved Suggestion */}
          {evaluation.improvedSuggestion && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <h3 className="font-semibold text-sm md:text-base">Suggested improvement:</h3>
                </div>
                <p className="text-sm break-words leading-relaxed mb-4">{evaluation.improvedSuggestion}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUseImprovedSuggestion}
                  data-testid="button-use-suggestion"
                >
                  Use this version
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Follow-up Questions */}
          {evaluation.followUpQuestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm md:text-base">Questions to consider:</h3>
              <div className="space-y-2">
                {evaluation.followUpQuestions.map((question, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3 px-4 whitespace-normal"
                    onClick={() => handleAskFollowUp(question)}
                    disabled={coachingMutation.isPending}
                    data-testid={`followup-question-${idx}`}
                  >
                    <MessageCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                    <span className="text-sm break-words leading-relaxed">{question}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}


          {/* Ask Coach */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm md:text-base">Need more help?</h3>
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask the coach for guidance..."
                value={coachingQuestion}
                onChange={(e) => setCoachingQuestion(e.target.value)}
                className="min-h-[60px] text-base md:text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAskCoach();
                  }
                }}
                data-testid="input-coaching-question"
              />
              <Button
                onClick={handleAskCoach}
                disabled={!coachingQuestion.trim() || coachingMutation.isPending}
                className="shrink-0"
                data-testid="button-ask-coach"
              >
                {coachingMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Ask'
                )}
              </Button>
            </div>
          </div>

          {/* Latest Coaching Response */}
          {coachingResponse && (
            <Card className="bg-primary/5">
              <CardContent className="pt-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">Coach says:</div>
                <p className="text-sm break-words leading-relaxed">{coachingResponse}</p>
              </CardContent>
            </Card>
          )}

          {/* Edit Answer */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm md:text-base">Revise your answer:</h3>
            <Textarea
              value={revisedAnswer}
              onChange={handleTextareaChange}
              className="min-h-[100px] text-sm md:text-base resize-none"
              placeholder="Enter your improved answer here..."
              data-testid="input-revised-answer"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {evaluation.improvedSuggestion && (
            <Button
              variant="ghost"
              onClick={handleGenerateNewSuggestion}
              disabled={coachingMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-generate-new-suggestion"
            >
              {coachingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate new suggestion'
              )}
            </Button>
          )}
          {!isInvalid && (
            <Button
              variant="outline"
              onClick={onOverride}
              className="w-full sm:w-auto"
              data-testid="button-continue-anyway"
            >
              Continue anyway
            </Button>
          )}
          <Button
            onClick={() => onRevise(revisedAnswer, isCurrentAnswerCoachGenerated)}
            disabled={!revisedAnswer.trim() || revisedAnswer === candidate}
            className="w-full sm:w-auto"
            data-testid="button-submit-revision"
          >
            {isInvalid ? 'Submit revision' : 'Use improved answer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
