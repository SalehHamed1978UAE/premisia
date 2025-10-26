import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ClarificationQuestion {
  id: string;
  question: string;
  options: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

interface ClarificationModalProps {
  questions: ClarificationQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

export function ClarificationModal({ questions, onSubmit, onSkip }: ClarificationModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const isComplete = questions.every(q => answers[q.id]);

  const handleSubmit = () => {
    if (isComplete) {
      onSubmit(answers);
    }
  };

  return (
    <Dialog open onOpenChange={onSkip}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-clarification">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-orange-500" />
            Just a Quick Clarification
          </DialogTitle>
          <DialogDescription>
            Your input could be interpreted in a few ways. Help us understand exactly what you mean so we can give you the best strategic advice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {questions.map((question, idx) => (
            <Card key={question.id} className="p-4" data-testid={`card-question-${idx}`}>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm dark:bg-indigo-900 dark:text-indigo-300">
                  {idx + 1}
                </span>
                {question.question}
              </h3>

              <RadioGroup
                value={answers[question.id]}
                onValueChange={(value) => setAnswers(prev => ({ ...prev, [question.id]: value }))}
              >
                <div className="space-y-3">
                  {question.options.map(option => (
                    <div
                      key={option.value}
                      className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        answers[question.id] === option.value
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                      }`}
                      onClick={() => setAnswers(prev => ({ ...prev, [question.id]: option.value }))}
                      data-testid={`option-${option.value}`}
                    >
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                        <div className="font-medium mb-1">{option.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {option.description}
                        </div>
                      </Label>
                      {answers[question.id] === option.value && (
                        <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 dark:text-indigo-400" />
                      )}
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={onSkip} data-testid="button-skip">
            Skip (Use Original Input)
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isComplete}
            className="gap-2"
            data-testid="button-submit-clarifications"
          >
            Continue with Clarifications
            {isComplete && <CheckCircle className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
