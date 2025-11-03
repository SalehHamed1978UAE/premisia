import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type CaptureGoldenRecordModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const JOURNEY_TYPES = [
  'digital_transformation',
  'market_entry',
  'business_model_innovation',
  'competitive_strategy',
  'crisis_recovery',
  'growth_strategy',
];

export function CaptureGoldenRecordModal({ open, onOpenChange }: CaptureGoldenRecordModalProps) {
  const { toast } = useToast();
  const [journeyType, setJourneyType] = useState('');
  const [notes, setNotes] = useState('');
  const [stepsJson, setStepsJson] = useState('');
  const [promoteAsCurrent, setPromoteAsCurrent] = useState(true);

  const captureMutation = useMutation({
    mutationFn: async () => {
      let steps;
      try {
        steps = JSON.parse(stepsJson || '[]');
      } catch (e) {
        throw new Error('Invalid JSON in steps field');
      }

      return apiRequest('POST', '/api/admin/golden-records', {
        journeyType,
        notes,
        steps,
        metadata: { capturedAt: new Date().toISOString() },
        promoteAsCurrent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/golden-records'] });
      toast({
        title: "Golden record captured",
        description: "The golden record has been saved successfully",
      });
      // Reset form
      setJourneyType('');
      setNotes('');
      setStepsJson('');
      setPromoteAsCurrent(true);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Capture failed",
        description: error.message || "Unable to capture golden record",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate journey type
    if (!journeyType) {
      toast({
        title: "Validation error",
        description: "Please select a journey type",
        variant: "destructive",
      });
      return;
    }

    // Validate steps JSON is not empty
    if (!stepsJson.trim()) {
      toast({
        title: "Validation error",
        description: "Steps JSON is required",
        variant: "destructive",
      });
      return;
    }

    // Validate steps JSON is valid and non-empty array
    let steps;
    try {
      steps = JSON.parse(stepsJson);
      if (!Array.isArray(steps)) {
        throw new Error('Steps must be a JSON array');
      }
      if (steps.length === 0) {
        throw new Error('Steps array cannot be empty');
      }
    } catch (e: any) {
      toast({
        title: "Invalid steps JSON",
        description: e.message || 'Please provide a valid JSON array with at least one step',
        variant: "destructive",
      });
      return;
    }

    captureMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Capture Golden Record</DialogTitle>
          <DialogDescription>
            Manually capture a golden path snapshot for a strategic journey. For automation, use the CLI capture tool.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="journeyType">Journey Type *</Label>
            <Select value={journeyType} onValueChange={setJourneyType}>
              <SelectTrigger id="journeyType" data-testid="select-journey-type">
                <SelectValue placeholder="Select journey type" />
              </SelectTrigger>
              <SelectContent>
                {JOURNEY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              data-testid="input-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe this golden record version (e.g., 'Initial BMI baseline', 'Updated with new research flow')"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="steps">Steps (JSON Array) *</Label>
            <Textarea
              id="steps"
              data-testid="input-steps-json"
              value={stepsJson}
              onChange={(e) => setStepsJson(e.target.value)}
              placeholder='[{"stepNumber": 1, "stepName": "Input", "expectedUrl": "/strategic-consultant/input", ...}]'
              rows={10}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Each step should include: stepNumber, stepName, expectedUrl, and optionally requestPayload, responsePayload, dbSnapshot, observations, screenshotPath
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="promoteAsCurrent"
              data-testid="checkbox-promote"
              checked={promoteAsCurrent}
              onChange={(e) => setPromoteAsCurrent(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="promoteAsCurrent" className="font-normal">
              Promote as current golden record
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={captureMutation.isPending}
              data-testid="button-submit-capture"
            >
              {captureMutation.isPending ? 'Capturing...' : 'Capture Golden Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
