/**
 * Gap Filler Component - Mobile-first UI for filling EPM gaps
 * Supports MULTI-SELECT for questions where users can choose multiple options
 */

import { useState } from 'react';
import { Check, ChevronRight, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SmartOption {
  id: string;
  label: string;
  sublabel?: string;
  value: any;
  confidence: number;
  recommended: boolean;
  source?: string;
}

interface GapQuestion {
  requirementId: string;
  question: string;
  description?: string;
  type: 'single_select' | 'multi_select' | 'scale' | 'timeline' | 'budget';
  options: SmartOption[];
  allowCustom: boolean;
  minSelections?: number;
  maxSelections?: number;
}

interface GapFillerProps {
  questions: GapQuestion[];
  onComplete: (answers: Record<string, string | string[]>) => void;
  onSkip?: () => void;
}

export function GapFiller({ questions, onComplete, onSkip }: GapFillerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isMultiSelect = currentQuestion?.type === 'multi_select';
  const currentSelection = answers[currentQuestion?.requirementId];

  const selectedIds = isMultiSelect
    ? (currentSelection as string[] || [])
    : currentSelection ? [currentSelection as string] : [];

  const handleOptionSelect = (option: SmartOption) => {
    const reqId = currentQuestion.requirementId;

    if (isMultiSelect) {
      const current = (answers[reqId] as string[] || []);
      const isSelected = current.includes(option.id);

      if (isSelected) {
        setAnswers({
          ...answers,
          [reqId]: current.filter(id => id !== option.id),
        });
      } else {
        const maxAllowed = currentQuestion.maxSelections || 5;
        if (current.length < maxAllowed) {
          setAnswers({
            ...answers,
            [reqId]: [...current, option.id],
          });
        }
      }
    } else {
      setAnswers({
        ...answers,
        [reqId]: option.id,
      });
    }
  };

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      const reqId = currentQuestion.requirementId;
      const customValue = `custom:${customInput.trim()}`;

      if (isMultiSelect) {
        const current = (answers[reqId] as string[] || []);
        setAnswers({
          ...answers,
          [reqId]: [...current, customValue],
        });
      } else {
        setAnswers({
          ...answers,
          [reqId]: customValue,
        });
      }

      setCustomInput('');
      setShowCustomInput(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowCustomInput(false);
      setCustomInput('');
    } else {
      onComplete(answers);
    }
  };

  const canProceed = () => {
    const selection = answers[currentQuestion?.requirementId];
    if (isMultiSelect) {
      const minRequired = currentQuestion.minSelections || 1;
      return (selection as string[] || []).length >= minRequired;
    }
    return !!selection;
  };

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="max-w-lg mx-auto p-4" data-testid="gap-filler">
      <div className="flex items-center gap-2 mb-6" data-testid="gap-filler-progress">
        {questions.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < currentIndex ? 'bg-primary' :
              i === currentIndex ? 'bg-primary/60' : 'bg-muted'
            )}
          />
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2" data-testid="gap-filler-question">
          {currentQuestion.question}
        </h2>
        {currentQuestion.description && (
          <p className="text-muted-foreground text-sm">{currentQuestion.description}</p>
        )}
        {isMultiSelect && (
          <p className="text-primary text-sm mt-2">
            Select all that apply
            {currentQuestion.maxSelections && ` (max ${currentQuestion.maxSelections})`}
          </p>
        )}
      </div>

      <div className="space-y-3 mb-6" data-testid="gap-filler-options">
        {currentQuestion.options.map((option) => {
          const isSelected = selectedIds.includes(option.id);

          return (
            <button
              key={option.id}
              onClick={() => handleOptionSelect(option)}
              data-testid={`option-${option.id}`}
              className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                'active:scale-[0.98]',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                )}>
                  {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.label}</span>
                    {option.recommended && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Recommended
                      </span>
                    )}
                  </div>
                  {option.sublabel && (
                    <p className="text-sm text-muted-foreground mt-1">{option.sublabel}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {currentQuestion.allowCustom && !showCustomInput && (
          <button
            onClick={() => setShowCustomInput(true)}
            data-testid="button-add-custom"
            className="w-full p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3 text-muted-foreground">
              <Plus className="w-5 h-5" />
              <span>Other (specify)</span>
            </div>
          </button>
        )}

        {showCustomInput && (
          <div className="p-4 rounded-xl border-2 border-primary bg-primary/5">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Enter your answer..."
              className="mb-3"
              autoFocus
              data-testid="input-custom"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCustomSubmit} disabled={!customInput.trim()} data-testid="button-add">
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setShowCustomInput(false);
                setCustomInput('');
              }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {onSkip && (
          <Button variant="ghost" onClick={onSkip} className="flex-1" data-testid="button-skip">
            Skip
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="flex-1"
          data-testid="button-next"
        >
          {currentIndex < questions.length - 1 ? (
            <>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          ) : (
            'Complete'
          )}
        </Button>
      </div>
    </div>
  );
}
