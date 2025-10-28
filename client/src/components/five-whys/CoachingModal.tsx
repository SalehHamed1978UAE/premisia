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
  onRevise: (newAnswer: string) => void;
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
  const [revisedAnswer, setRevisedAnswer] = useState(candidate);
  const [coachingQuestion, setCoachingQuestion] = useState("");
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [coachingResponse, setCoachingResponse] = useState<string>("");

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
      setRevisedAnswer(evaluation.improvedSuggestion);
    }
  };

  const isInvalid = evaluation.verdict === 'invalid';
  const needsClarification = evaluation.verdict === 'needs_clarification';
  const criticalIssues = evaluation.issues.filter(i => i.severity === 'critical');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="coaching-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl md:text-2xl">
            {isInvalid && <AlertCircle className="w-6 h-6 text-destructive" />}
            {needsClarification && <AlertTriangle className="w-6 h-6 text-yellow-600" />}
            {isInvalid ? 'Let\'s Improve This Answer' : 'Consider Refining This'}
          </DialogTitle>
          <DialogDescription className="text-base md:text-lg">
            {isInvalid 
              ? 'This answer needs refinement before we can continue the analysis.'
              : 'This answer could be stronger. Let me help you think it through.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Answer */}
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-2">Your current answer:</div>
              <p className="text-base font-medium">{candidate}</p>
            </CardContent>
          </Card>

          {/* Issues */}
          {evaluation.issues.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                What to improve:
              </h3>
              <div className="space-y-2">
                {evaluation.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-md border ${
                      issue.severity === 'critical'
                        ? 'bg-destructive/10 border-destructive/30'
                        : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                    }`}
                    data-testid={`issue-${idx}`}
                  >
                    <div className="flex items-start gap-2">
                      <Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'} className="mt-0.5">
                        {issue.type}
                      </Badge>
                      <p className="text-sm flex-1">{issue.message}</p>
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
                <div className="flex items-start gap-2 mb-2">
                  <Lightbulb className="w-5 h-5 text-primary mt-0.5" />
                  <h3 className="font-semibold text-base">Suggested improvement:</h3>
                </div>
                <p className="text-sm mb-3 pl-7">{evaluation.improvedSuggestion}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUseImprovedSuggestion}
                  className="ml-7"
                  data-testid="button-use-suggestion"
                >
                  Use this version
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Follow-up Questions */}
          {evaluation.followUpQuestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-base">Questions to consider:</h3>
              <div className="space-y-2">
                {evaluation.followUpQuestions.map((question, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3 px-4"
                    onClick={() => handleAskFollowUp(question)}
                    disabled={coachingMutation.isPending}
                    data-testid={`followup-question-${idx}`}
                  >
                    <MessageCircle className="w-4 h-4 mr-2 shrink-0" />
                    <span className="text-sm">{question}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Conversation */}
          {conversationHistory.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-base">Coaching conversation:</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {conversationHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-md ${
                      msg.role === 'user'
                        ? 'bg-muted ml-8'
                        : 'bg-primary/10 mr-8'
                    }`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {msg.role === 'user' ? 'You' : 'Coach'}
                    </div>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ask Coach */}
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Need more help?</h3>
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
                <div className="text-xs text-muted-foreground mb-1">Coach says:</div>
                <p className="text-sm">{coachingResponse}</p>
              </CardContent>
            </Card>
          )}

          {/* Edit Answer */}
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Revise your answer:</h3>
            <Textarea
              value={revisedAnswer}
              onChange={(e) => setRevisedAnswer(e.target.value)}
              className="min-h-[100px] text-base md:text-sm"
              data-testid="input-revised-answer"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
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
            onClick={() => onRevise(revisedAnswer)}
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
