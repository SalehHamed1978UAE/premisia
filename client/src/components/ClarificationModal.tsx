import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClarificationQuestion {
  id: string;
  question: string;
  multiSelect?: boolean;
  options: Array<{
    value: string;
    label: string;
    description: string;
  }>;
  allowManualEntry?: boolean;
  manualEntryPlaceholder?: string;
}

interface ClarificationModalProps {
  questions: ClarificationQuestion[];
  onSubmit: (answers: Record<string, string | string[] | any>) => void;
  onSkip: () => void;
}

export function ClarificationModal({ questions, onSubmit, onSkip }: ClarificationModalProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [manualEntries, setManualEntries] = useState<Record<string, string>>({});
  const [showManualInput, setShowManualInput] = useState<Record<string, boolean>>({});
  const [validationResults, setValidationResults] = useState<Record<string, any>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [showValidationSuggestions, setShowValidationSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, any>>({});
  const { toast } = useToast();

  const isComplete = questions.every(q => {
    const answer = answers[q.id];
    
    // If manual entry is selected, check that manual input is provided
    if (answer === 'manual_entry' && q.allowManualEntry) {
      return !!manualEntries[q.id]?.trim();
    }
    
    if (q.multiSelect) {
      return Array.isArray(answer) && answer.length > 0;
    }
    return typeof answer === 'string' && answer.length > 0;
  });

  const handleSubmit = async () => {
    if (!isComplete) return;

    setIsValidating(true);

    try {
      // Step 1: Validate all manual entries (use local variable to avoid async state issues)
      const localValidationResults: Record<string, any> = {};
      const questionsWithManualEntry = questions.filter(q => 
        answers[q.id] === 'manual_entry' && manualEntries[q.id]?.trim()
      );

      for (const question of questionsWithManualEntry) {
        const manualEntry = manualEntries[question.id].trim();

        try {
          const res = await fetch('/api/strategic-consultant/validate-manual-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userInput: manualEntry })
          });

          if (!res.ok) {
            throw new Error('Validation service unavailable');
          }

          const result = await res.json();
          localValidationResults[question.id] = result;

        } catch (error: any) {
          toast({
            title: "Validation error",
            description: error.message || "Failed to validate location",
            variant: "destructive"
          });

          localValidationResults[question.id] = { 
            validated: false, 
            originalInput: manualEntry, 
            error: true 
          };
        }
      }

      // Step 2: Check if any have suggestions - SHOW UI if yes
      const needsSuggestionSelection = Object.entries(localValidationResults).some(
        ([_, result]) => result.validated && result.suggestions?.length > 0
      );

      if (needsSuggestionSelection) {
        // Show suggestions UI - don't submit yet!
        setValidationResults(localValidationResults);
        setShowValidationSuggestions(true);
        setIsValidating(false);
        return;
      }

      // Step 3: No suggestions - proceed with confirmation for unvalidated entries
      const hasUnvalidated = Object.values(localValidationResults).some(r => !r.validated);
      if (hasUnvalidated) {
        const unvalidatedEntries = Object.entries(localValidationResults)
          .filter(([_, r]) => !r.validated)
          .map(([qId, r]) => r.originalInput)
          .join(', ');

        const confirmed = window.confirm(
          `We couldn't verify the following location(s): ${unvalidatedEntries}. Would you like to proceed anyway?`
        );

        if (!confirmed) {
          setIsValidating(false);
          return;
        }
      }

      // Step 4: Submit with validation data
      const finalAnswers: Record<string, any> = {};

      questions.forEach(q => {
        const answer = answers[q.id];

        if (answer === 'manual_entry' && q.allowManualEntry) {
          finalAnswers[q.id] = {
            selectedOption: 'manual_entry',
            manualEntry: {
              rawInput: manualEntries[q.id],
              validationResult: localValidationResults[q.id]
            }
          };
        } else {
          finalAnswers[q.id] = answer;
        }
      });

      onSubmit(finalAnswers);

    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmSuggestions = () => {
    // Validate that all questions with suggestions have a selection
    const questionsWithSuggestions = Object.entries(validationResults).filter(
      ([_, result]) => result.validated && result.suggestions?.length > 0
    );

    const allSelected = questionsWithSuggestions.every(([qId, _]) => 
      selectedSuggestions[qId] !== undefined
    );

    if (!allSelected) {
      toast({
        title: "Please select an option",
        description: "Choose a location for each validation result before continuing",
        variant: "destructive"
      });
      return;
    }

    // Build final answers with selected suggestions
    const finalAnswers: Record<string, any> = {};

    questions.forEach(q => {
      const answer = answers[q.id];

      if (answer === 'manual_entry' && q.allowManualEntry) {
        const selection = selectedSuggestions[q.id];
        
        if (selection === 'use_as_entered') {
          // User chose to use original input
          finalAnswers[q.id] = {
            selectedOption: 'manual_entry',
            manualEntry: {
              rawInput: manualEntries[q.id],
              validationResult: { validated: false, originalInput: manualEntries[q.id], userChoice: 'use_as_entered' }
            }
          };
        } else {
          // User selected a suggestion
          finalAnswers[q.id] = {
            selectedOption: 'manual_entry',
            manualEntry: {
              rawInput: manualEntries[q.id],
              validationResult: validationResults[q.id],
              selectedSuggestion: selection
            }
          };
        }
      } else {
        finalAnswers[q.id] = answer;
      }
    });

    onSubmit(finalAnswers);
  };

  const handleMultiSelectToggle = (questionId: string, optionValue: string) => {
    setAnswers(prev => {
      const current = prev[questionId] as string[] || [];
      const newValue = current.includes(optionValue)
        ? current.filter(v => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [questionId]: newValue };
    });
  };

  const handleManualEntrySelect = (questionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: 'manual_entry' }));
    setShowManualInput(prev => ({ ...prev, [questionId]: true }));
  };

  const handleRegularOptionSelect = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setShowManualInput(prev => ({ ...prev, [questionId]: false }));
    // Clear manual entry when switching back to regular option
    setManualEntries(prev => {
      const updated = { ...prev };
      delete updated[questionId];
      return updated;
    });
  };

  return (
    <Dialog open onOpenChange={onSkip}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background" data-testid="modal-clarification">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-orange-500" />
            Just a Quick Clarification
          </DialogTitle>
          <DialogDescription>
            Your input could be interpreted in a few ways. Help us understand exactly what you mean so we can give you the best strategic advice.
          </DialogDescription>
        </DialogHeader>

        {/* Validation Suggestions UI - shown when we need user to select from suggestions */}
        {showValidationSuggestions && (
          <div className="space-y-6 py-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Location Verification Results
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                We found multiple matches for your location input. Please select which one you meant:
              </p>
            </div>

            {Object.entries(validationResults).map(([questionId, result]) => {
              if (!result.validated || !result.suggestions?.length) return null;

              const question = questions.find(q => q.id === questionId);
              if (!question) return null;

              return (
                <Card key={questionId} className="p-4" data-testid={`card-validation-${questionId}`}>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    You entered: "{manualEntries[questionId]}"
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Which location did you mean?
                  </p>

                  <RadioGroup
                    value={selectedSuggestions[questionId]}
                    onValueChange={(value) => {
                      setSelectedSuggestions(prev => ({ ...prev, [questionId]: value }));
                    }}
                  >
                    <div className="space-y-3">
                      {result.suggestions.map((suggestion: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedSuggestions[questionId] === JSON.stringify(suggestion)
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400'
                              : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                          }`}
                          onClick={() => setSelectedSuggestions(prev => ({ 
                            ...prev, 
                            [questionId]: JSON.stringify(suggestion) 
                          }))}
                          data-testid={`radio-suggestion-${questionId}-${idx}`}
                        >
                          <RadioGroupItem 
                            value={JSON.stringify(suggestion)} 
                            id={`suggestion-${questionId}-${idx}`} 
                          />
                          <Label htmlFor={`suggestion-${questionId}-${idx}`} className="flex-1 cursor-pointer">
                            <div className="font-medium mb-1">
                              {suggestion.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {[suggestion.adminName1, suggestion.countryName]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Coordinates: {suggestion.lat}, {suggestion.lng}
                            </div>
                          </Label>
                          {selectedSuggestions[questionId] === JSON.stringify(suggestion) && (
                            <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 dark:text-indigo-400" />
                          )}
                        </div>
                      ))}

                      {/* "Neither - use as entered" option */}
                      <div
                        className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedSuggestions[questionId] === 'use_as_entered'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                        }`}
                        onClick={() => setSelectedSuggestions(prev => ({ 
                          ...prev, 
                          [questionId]: 'use_as_entered' 
                        }))}
                        data-testid={`radio-suggestion-${questionId}-use-as-entered`}
                      >
                        <RadioGroupItem 
                          value="use_as_entered" 
                          id={`use-as-entered-${questionId}`} 
                        />
                        <Label htmlFor={`use-as-entered-${questionId}`} className="flex-1 cursor-pointer">
                          <div className="font-medium mb-1">
                            Neither - use "{manualEntries[questionId]}" as entered
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Proceed with the original text without specific coordinates
                          </div>
                        </Label>
                        {selectedSuggestions[questionId] === 'use_as_entered' && (
                          <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 dark:text-indigo-400" />
                        )}
                      </div>
                    </div>
                  </RadioGroup>
                </Card>
              );
            })}
          </div>
        )}

        {/* Normal Questions UI - shown initially */}
        {!showValidationSuggestions && (
          <div className="space-y-6 py-4">
            {questions.map((question, idx) => (
              <Card key={question.id} className="p-4" data-testid={`card-question-${idx}`}>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm dark:bg-indigo-900 dark:text-indigo-300">
                  {idx + 1}
                </span>
                {question.question}
                {question.multiSelect && (
                  <span className="text-xs text-muted-foreground font-normal">(Select all that apply)</span>
                )}
              </h3>

              {question.multiSelect ? (
                <div className="space-y-3">
                  {question.options.map(option => {
                    const isSelected = (answers[question.id] as string[] || []).includes(option.value);
                    return (
                      <div
                        key={option.value}
                        className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                        }`}
                        data-testid={`option-${option.value}`}
                      >
                        <Checkbox
                          id={option.value}
                          checked={isSelected}
                          onCheckedChange={() => handleMultiSelectToggle(question.id, option.value)}
                        />
                        <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                          <div className="font-medium mb-1">{option.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {option.description}
                          </div>
                        </Label>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 dark:text-indigo-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <RadioGroup
                  value={answers[question.id] as string}
                  onValueChange={(value) => {
                    if (value === 'manual_entry') {
                      handleManualEntrySelect(question.id);
                    } else {
                      handleRegularOptionSelect(question.id, value);
                    }
                  }}
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
                        onClick={() => handleRegularOptionSelect(question.id, option.value)}
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

                    {/* Add "Other" option for geographic questions */}
                    {question.allowManualEntry && (
                      <>
                        <div
                          className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            answers[question.id] === 'manual_entry'
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400'
                              : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                          }`}
                          onClick={() => handleManualEntrySelect(question.id)}
                          data-testid={`radio-manual-entry-${question.id}`}
                        >
                          <RadioGroupItem value="manual_entry" id={`manual-entry-${question.id}`} />
                          <Label htmlFor={`manual-entry-${question.id}`} className="flex-1 cursor-pointer">
                            <div className="font-medium mb-1 flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Other / Specify a different location
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Enter a custom location if none of the above match
                            </div>
                          </Label>
                          {answers[question.id] === 'manual_entry' && (
                            <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 dark:text-indigo-400" />
                          )}
                        </div>

                        {/* Manual entry input (shown when "Other" is selected) */}
                        {showManualInput[question.id] && answers[question.id] === 'manual_entry' && (
                          <div className="ml-6 mt-2 space-y-2">
                            <Input
                              type="text"
                              placeholder={question.manualEntryPlaceholder || "e.g., San Francisco, CA or Europe"}
                              value={manualEntries[question.id] || ''}
                              onChange={(e) => setManualEntries(prev => ({
                                ...prev,
                                [question.id]: e.target.value
                              }))}
                              data-testid={`input-manual-location-${question.id}`}
                              className="w-full"
                            />
                            <p className="text-xs text-muted-foreground">
                              We'll validate your location when you submit
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </RadioGroup>
              )}
            </Card>
          ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          {showValidationSuggestions ? (
            <>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowValidationSuggestions(false);
                  setSelectedSuggestions({});
                }} 
                data-testid="button-back-to-questions"
              >
                ← Back to Questions
              </Button>
              <Button
                onClick={handleConfirmSuggestions}
                className="gap-2"
                data-testid="button-confirm-suggestions"
              >
                Continue with Selection
                <CheckCircle className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onSkip} disabled={isValidating} data-testid="button-skip">
                Skip (Use Original Input)
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isComplete || isValidating}
                className="gap-2"
                data-testid="button-submit-clarifications"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    Continue with Clarifications
                    {isComplete && <CheckCircle className="w-4 h-4" />}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
