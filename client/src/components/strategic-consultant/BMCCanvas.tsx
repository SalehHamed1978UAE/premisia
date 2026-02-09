import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  Lightbulb, 
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Radio,
  Heart,
  Package,
  Zap,
  Handshake,
  TrendingDown
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

export interface BMCFinding {
  fact: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
  validationStrength?: 'STRONG' | 'MODERATE' | 'WEAK';
}

export interface BMCBlock {
  blockType: string;
  blockName: string;
  description: string;
  findings: BMCFinding[];
  confidence: 'weak' | 'moderate' | 'strong';
  strategicImplications: string;
  gaps: string[];
}

export interface Assumption {
  assumption: string;
  confidence: 'high' | 'medium' | 'low';
  category: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  investmentAmount?: string;
}

export interface Contradiction {
  assumption: string;
  contradictedBy: string[];
  impact: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  investmentAmount?: string;
}

export interface BMCAnalysis {
  blocks: BMCBlock[];
  viability: string;
  overallConfidence: number;
  keyInsights: string[];
  criticalGaps: string[];
  consistencyChecks?: Array<{
    aspect: string;
    status: 'aligned' | 'misaligned' | 'uncertain';
    explanation: string;
  }>;
  recommendations?: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    rationale: string;
  }>;
  assumptions?: Assumption[];
  contradictions?: Contradiction[];
}

interface BMCCanvasProps {
  analysis: BMCAnalysis;
}

const BLOCK_ICONS = {
  customer_segments: { icon: Users, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950" },
  value_propositions: { icon: Lightbulb, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950" },
  revenue_streams: { icon: DollarSign, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950" },
  channels: { icon: Radio, color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-950" },
  customer_relationships: { icon: Heart, color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-50 dark:bg-pink-950" },
  key_resources: { icon: Package, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950" },
  key_activities: { icon: Zap, color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-50 dark:bg-yellow-950" },
  key_partnerships: { icon: Handshake, color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-50 dark:bg-indigo-950" },
  cost_structure: { icon: TrendingDown, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950" },
};

const CONFIDENCE_COLORS = {
  strong: { badge: "default", text: "Strong", icon: CheckCircle2, color: "text-green-600" },
  moderate: { badge: "secondary", text: "Moderate", icon: Info, color: "text-amber-600" },
  weak: { badge: "outline", text: "Weak", icon: AlertCircle, color: "text-red-600" },
};

const VALIDATION_INDICATORS = {
  STRONG: { emoji: "🟢", text: "Strong validation" },
  MODERATE: { emoji: "🟡", text: "Moderate validation" },
  WEAK: { emoji: "🔴", text: "Weak validation" },
};

export function BMCCanvas({ analysis }: BMCCanvasProps) {
  const { blocks, viability, overallConfidence, keyInsights, criticalGaps, consistencyChecks, recommendations, assumptions, contradictions } = analysis;
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});

  const toggleFindings = (blockType: string) => {
    setExpandedFindings(prev => ({
      ...prev,
      [blockType]: !prev[blockType]
    }));
  };

  const viabilityInfo = CONFIDENCE_COLORS[viability as keyof typeof CONFIDENCE_COLORS] || CONFIDENCE_COLORS.weak;
  const ViabilityIcon = viabilityInfo.icon;

  return (
    <div className="space-y-6" data-testid="bmc-canvas-container">
      {/* Overall Viability */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl" data-testid="bmc-viability-title">Business Model Viability</CardTitle>
              <CardDescription>AI-powered assessment based on market research</CardDescription>
            </div>
            <Badge variant={viabilityInfo.badge as any} className="text-lg px-4 py-2" data-testid="viability-badge">
              <ViabilityIcon className="h-4 w-4 mr-2" />
              {viabilityInfo.text}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Confidence</span>
              <span className="font-medium" data-testid="overall-confidence">{Math.round(overallConfidence * 100)}%</span>
            </div>
            <Progress value={overallConfidence * 100} className="h-2" data-testid="overall-confidence-progress" />
          </div>

          {keyInsights.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Key Insights
              </h4>
              <ul className="space-y-2" data-testid="key-insights">
                {keyInsights.map((insight, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {criticalGaps.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Critical Gaps Identified:</p>
                <ul className="mt-1 list-disc list-inside" data-testid="critical-gaps">
                  {criticalGaps.map((gap, i) => (
                    <li key={i} className="text-sm">{gap}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Desktop: Grid Layout (3x3), Mobile: Accordion */}
      <div className="hidden md:grid md:grid-cols-3 gap-4" data-testid="bmc-blocks-grid">
        {blocks.map((block) => {
          const blockInfo = BLOCK_ICONS[block.blockType as keyof typeof BLOCK_ICONS];
          const BlockIcon = blockInfo?.icon || Users;
          const confidenceInfo = CONFIDENCE_COLORS[block.confidence];
          const ConfidenceIcon = confidenceInfo.icon;

          return (
            <Card key={block.blockType} className="h-full" data-testid={`block-${block.blockType}`}>
              <CardHeader className={blockInfo?.bgColor}>
                <div className="flex items-center gap-2">
                  <BlockIcon className={`h-5 w-5 ${blockInfo?.color}`} />
                  <CardTitle className="text-lg">{block.blockName}</CardTitle>
                </div>
                <Badge variant={confidenceInfo.badge as any} className="w-fit" data-testid={`confidence-${block.blockType}`}>
                  <ConfidenceIcon className="h-3 w-3 mr-1" />
                  {confidenceInfo.text}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground" data-testid={`description-${block.blockType}`}>
                  {block.description}
                </p>

                {block.findings.length > 0 && (
                  <div className="space-y-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleFindings(block.blockType)}
                      data-testid={`toggle-findings-${block.blockType}`}
                    >
                      <h5 className="text-sm font-medium">Research Findings ({block.findings.length})</h5>
                      {expandedFindings[block.blockType] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    {expandedFindings[block.blockType] && (
                      <ul className="space-y-2" data-testid={`findings-${block.blockType}`}>
                        {block.findings.slice(0, 3).map((finding, i) => {
                          const validation = finding.validationStrength ? VALIDATION_INDICATORS[finding.validationStrength] : null;
                          return (
                            <li key={i} className="text-xs border-l-2 pl-2 py-1">
                              <div className="flex items-start gap-1">
                                {validation && <span title={validation.text}>{validation.emoji}</span>}
                                <p>{finding.fact}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {block.strategicImplications && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs" data-testid={`implications-${block.blockType}`}>
                      {block.strategicImplications}
                    </AlertDescription>
                  </Alert>
                )}

                {block.gaps.length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-medium text-amber-600 dark:text-amber-400">Gaps</h5>
                    <ul className="text-xs space-y-1" data-testid={`gaps-${block.blockType}`}>
                      {block.gaps.slice(0, 2).map((gap, i) => (
                        <li key={i} className="flex gap-1">
                          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mobile: Accordion Layout */}
      <Accordion type="single" collapsible className="md:hidden" data-testid="bmc-blocks-accordion">
        {blocks.map((block) => {
          const blockInfo = BLOCK_ICONS[block.blockType as keyof typeof BLOCK_ICONS];
          const BlockIcon = blockInfo?.icon || Users;
          const confidenceInfo = CONFIDENCE_COLORS[block.confidence];

          return (
            <AccordionItem key={block.blockType} value={block.blockType}>
              <AccordionTrigger className="hover:no-underline" data-testid={`accordion-trigger-${block.blockType}`}>
                <div className="flex items-center gap-3 w-full">
                  <div className={`p-2 rounded-lg ${blockInfo?.bgColor}`}>
                    <BlockIcon className={`h-4 w-4 ${blockInfo?.color}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{block.blockName}</p>
                    <Badge variant={confidenceInfo.badge as any} className="mt-1">
                      {confidenceInfo.text}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-3" data-testid={`accordion-content-${block.blockType}`}>
                <p className="text-sm text-muted-foreground">{block.description}</p>
                
                {block.findings.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium">Research Findings ({block.findings.length})</h5>
                    <ul className="space-y-2" data-testid={`mobile-findings-${block.blockType}`}>
                      {block.findings.slice(0, 3).map((finding, i) => {
                        const validation = finding.validationStrength ? VALIDATION_INDICATORS[finding.validationStrength] : null;
                        return (
                          <li key={i} className="text-xs border-l-2 pl-2 py-1">
                            <div className="flex items-start gap-1">
                              {validation && <span title={validation.text}>{validation.emoji}</span>}
                              <p>{finding.fact}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                {block.strategicImplications && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {block.strategicImplications}
                    </AlertDescription>
                  </Alert>
                )}
                {block.gaps.length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-medium text-amber-600 dark:text-amber-400">Gaps</h5>
                    <ul className="text-xs space-y-1">
                      {block.gaps.map((gap, i) => (
                        <li key={i} className="flex gap-1">
                          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Contradictions Alert */}
      {contradictions && contradictions.length > 0 && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950" data-testid="contradictions-alert">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <div className="space-y-3">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                🚨 {contradictions.length} Assumption{contradictions.length > 1 ? 's' : ''} Contradicted by Research
              </p>
              <div className="space-y-2">
                {contradictions.map((contradiction, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant="destructive" className="text-xs">
                        {contradiction.impact} impact
                      </Badge>
                      {contradiction.investmentAmount && contradiction.investmentAmount.trim() !== '' && (
                        <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700">
                          ⚠️ ${contradiction.investmentAmount} at risk
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      "{contradiction.assumption}"
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>Research found:</strong> {contradiction.contradictedBy.join('; ')}
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>💡 Recommendation:</strong> {contradiction.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Consistency Checks & Recommendations */}
      {(consistencyChecks || recommendations) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {consistencyChecks && consistencyChecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Consistency Checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2" data-testid="consistency-checks">
                {consistencyChecks.map((check, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge variant={check.status === 'aligned' ? 'default' : check.status === 'misaligned' ? 'destructive' : 'secondary'}>
                      {check.status}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{check.aspect}</p>
                      <p className="text-xs text-muted-foreground">{check.explanation}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {recommendations && recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2" data-testid="recommendations">
                {recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'}>
                      {rec.priority}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{rec.action}</p>
                      <p className="text-xs text-muted-foreground">{rec.rationale}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
