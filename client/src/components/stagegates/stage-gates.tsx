import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Flag, 
  CheckCircle, 
  Clock, 
  Plus, 
  AlertCircle,
  Calendar
} from "lucide-react";
import type { StageGate, StageGateReview } from "@shared/schema";

export function StageGates() {
  const { data: stageGates, isLoading: gatesLoading } = useQuery<StageGate[]>({
    queryKey: ['/api/stage-gates'],
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery<StageGateReview[]>({
    queryKey: ['/api/stage-gates/reviews'],
  });

  const isLoading = gatesLoading || reviewsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-8">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <Skeleton className="w-16 h-16 rounded-full mb-2" />
                  <Skeleton className="h-4 w-8 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const defaultGates = [
    { code: 'G0', name: 'Ideation', description: 'Project concept and initiation' },
    { code: 'G1', name: 'Concept', description: 'Requirements definition and feasibility' },
    { code: 'G2', name: 'Feasibility', description: 'Solution design and planning' },
    { code: 'G3', name: 'Development', description: 'Implementation and testing' },
    { code: 'G4', name: 'Launch', description: 'Deployment and go-live' },
  ];

  const gates = stageGates && stageGates.length > 0 ? stageGates : defaultGates;

  const getGateStatus = (gateCode: string) => {
    if (!reviews) return 'Pending';
    const gateReview = reviews.find(review => {
      const gate = gates.find(g => 'id' in g && g.id === review.stageGateId);
      return gate && 'code' in gate && gate.code === gateCode;
    });
    return gateReview?.status || 'Pending';
  };

  const getGateReviewDate = (gateCode: string) => {
    if (!reviews) return null;
    const gateReview = reviews.find(review => {
      const gate = gates.find(g => 'id' in g && g.id === review.stageGateId);
      return gate && 'code' in gate && gate.code === gateCode;
    });
    return gateReview?.reviewDate || null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Passed':
        return 'bg-green-100 text-green-800';
      case 'In Review':
        return 'bg-blue-100 text-blue-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      case 'On Hold':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getGateIcon = (status: string, index: number) => {
    switch (status) {
      case 'Passed':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      case 'In Review':
        return <Clock className="h-8 w-8 text-blue-600" />;
      case 'Failed':
        return <AlertCircle className="h-8 w-8 text-red-600" />;
      default:
        return <span className="text-lg font-bold text-gray-500">{index}</span>;
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div></div>
        <Button data-testid="button-add-review">
          <Plus className="h-4 w-4 mr-2" />
          Add Review
        </Button>
      </div>

      {/* Stage Gates Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Flag className="h-5 w-5" />
            <span>Stage Gates Progress</span>
          </CardTitle>
          <CardDescription>Program milestone checkpoints (G0-G4)</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative">
            <div className="flex justify-between items-start mb-8">
              <div className="absolute top-8 left-0 right-0 h-0.5 bg-border z-0"></div>
              
              {gates.map((gate, index) => {
                const status = getGateStatus(gate.code);
                const reviewDate = getGateReviewDate(gate.code);
                
                return (
                  <div key={gate.code} className="relative flex flex-col items-center z-10">
                    <div className={`w-16 h-16 rounded-full border-4 border-background flex items-center justify-center mb-3 shadow-lg ${
                      status === 'Passed' ? 'bg-green-500' :
                      status === 'In Review' ? 'bg-blue-500' :
                      status === 'Failed' ? 'bg-red-500' :
                      'bg-gray-300'
                    }`}>
                      {getGateIcon(status, index)}
                    </div>
                    
                    <div className="text-center">
                      <p className="font-semibold text-sm text-foreground mb-1">
                        {gate.code}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {gate.name}
                      </p>
                      <Badge className={getStatusColor(status)} data-testid={`gate-status-${gate.code}`}>
                        {status}
                      </Badge>
                      {reviewDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(reviewDate)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage Gate Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {gates.map((gate, index) => {
          const status = getGateStatus(gate.code);
          const reviewDate = getGateReviewDate(gate.code);
          
          return (
            <Card key={gate.code} data-testid={`gate-card-${gate.code}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      status === 'Passed' ? 'bg-green-100' :
                      status === 'In Review' ? 'bg-blue-100' :
                      status === 'Failed' ? 'bg-red-100' :
                      'bg-gray-100'
                    }`}>
                      <Flag className={`h-6 w-6 ${
                        status === 'Passed' ? 'text-green-600' :
                        status === 'In Review' ? 'text-blue-600' :
                        status === 'Failed' ? 'text-red-600' :
                        'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <CardTitle>{gate.code} - {gate.name}</CardTitle>
                      <CardDescription>{gate.description}</CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(status)}>
                    {status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Success Criteria</h4>
                  <div className="space-y-2">
                    {/* Default criteria - in real implementation, this would come from the database */}
                    <div className="flex items-start space-x-2">
                      <div className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${
                        status === 'Passed' ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        {status === 'Passed' && <CheckCircle className="h-4 w-4 text-white" />}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {getDefaultCriteria(gate.code)[0]}
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${
                        status === 'Passed' ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        {status === 'Passed' && <CheckCircle className="h-4 w-4 text-white" />}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {getDefaultCriteria(gate.code)[1]}
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${
                        status === 'Passed' ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        {status === 'Passed' && <CheckCircle className="h-4 w-4 text-white" />}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {getDefaultCriteria(gate.code)[2]}
                      </span>
                    </div>
                  </div>
                </div>
                
                {reviewDate && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Review Date:</span>
                      <span className="font-medium">{formatDate(reviewDate)}</span>
                    </div>
                  </div>
                )}

                {status === 'Pending' && (
                  <Button variant="outline" className="w-full" data-testid={`schedule-review-${gate.code}`}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Review
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Review History */}
      {reviews && reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review History</CardTitle>
            <CardDescription>Completed stage gate reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reviews.map((review) => {
                const gate = gates.find(g => 'id' in g && g.id === review.stageGateId);
                return (
                  <div key={review.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">
                        {gate && 'code' in gate ? gate.code : 'Unknown'} - {gate && 'name' in gate ? gate.name : 'Unknown'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Reviewed on {formatDate(review.reviewDate)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(review.status)}>
                      {review.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getDefaultCriteria(gateCode: string): string[] {
  switch (gateCode) {
    case 'G0':
      return [
        'Business case approved',
        'Initial budget allocated',
        'Program charter signed'
      ];
    case 'G1':
      return [
        'Requirements documented',
        'Stakeholder alignment achieved',
        'Technical feasibility confirmed'
      ];
    case 'G2':
      return [
        'Architecture design approved',
        'Security review completed',
        'Detailed project plan finalized'
      ];
    case 'G3':
      return [
        'All development work completed',
        'Testing successfully completed',
        'Documentation finalized'
      ];
    case 'G4':
      return [
        'Production deployment completed',
        'User training delivered',
        'Benefits realization plan active'
      ];
    default:
      return [
        'Success criteria defined',
        'Deliverables completed',
        'Quality gates passed'
      ];
  }
}
