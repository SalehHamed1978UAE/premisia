import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Users, 
  Clock, 
  DollarSign, 
  Target, 
  AlertTriangle,
  CheckCircle2,
  Flag,
  Building2,
  FileCheck,
  ShoppingCart,
  LogOut,
  Calendar
} from "lucide-react";
import {
  ExecutiveSummary,
  Workstream,
  Timeline,
  ResourcePlan,
  FinancialPlan,
  BenefitsRealization,
  RiskRegister,
  StageGates,
  KPIs,
  StakeholderMap,
  Governance,
  QAPlan,
  Procurement,
  ExitStrategy
} from "@/types/intelligence";

// ============================================================================
// Helper Components
// ============================================================================

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-semibold text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function KeyValue({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 ${className}`}>
      <span className="text-sm font-medium sm:min-w-[120px] flex-shrink-0">{label}:</span>
      <span className="text-sm text-muted-foreground flex-1 break-words overflow-wrap-anywhere">{value}</span>
    </div>
  );
}

type ListItem = string | {
  action?: string;
  description?: string;
  name?: string;
  priority?: 'high' | 'medium' | 'low';
  rationale?: string;
  [key: string]: any;
};

function List({ items, className = "" }: { items: ListItem[]; className?: string }) {
  if (!items || items.length === 0) return <span className="text-sm text-muted-foreground italic">None specified</span>;
  
  return (
    <ul className={`space-y-1 ${className}`}>
      {items.map((item, i) => {
        // Handle string items
        if (typeof item === 'string') {
          return (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span className="flex-1">{item}</span>
            </li>
          );
        }
        
        // Handle structured object items
        if (typeof item === 'object' && item !== null) {
          const text = item.action || item.description || item.name;
          const priority = item.priority;
          const rationale = item.rationale;
          
          // If no recognizable fields, skip this item
          if (!text) {
            console.warn('List item missing text fields:', item);
            return null;
          }
          
          return (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <span>{text}</span>
                  {priority && (
                    <Badge variant={priority === 'high' ? 'destructive' : priority === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                      {priority}
                    </Badge>
                  )}
                </div>
                {rationale && (
                  <p className="text-xs text-muted-foreground italic pl-4">{rationale}</p>
                )}
              </div>
            </li>
          );
        }
        
        return null;
      })}
    </ul>
  );
}

// ============================================================================
// 1. Executive Summary Formatter
// ============================================================================

export function ExecutiveSummaryFormatter({ data }: { data: ExecutiveSummary }) {
  return (
    <div className="space-y-6">
      {data.title && (
        <div className="pb-4 border-b">
          <h2 className="text-2xl font-bold">{data.title}</h2>
        </div>
      )}

      <Section title="Market Opportunity" icon={TrendingUp}>
        <p className="text-sm">{data.marketOpportunity}</p>
      </Section>

      <Section title="Strategic Imperatives" icon={Target}>
        <List items={data.strategicImperatives || []} />
      </Section>

      <Section title="Key Success Factors" icon={CheckCircle2}>
        <List items={data.keySuccessFactors || []} />
      </Section>

      <Section title="Risk Summary" icon={AlertTriangle}>
        <p className="text-sm">{data.riskSummary}</p>
      </Section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
        <KeyValue label="Investment Required" value={data.investmentRequired} />
        {data.expectedOutcomes && (
          <div>
            <div className="text-sm font-medium mb-2">Expected Outcomes</div>
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
              {data.expectedOutcomes
                .split(/[;\n]+/)
                .filter(Boolean)
                .map((outcome, idx) => (
                  <li key={idx}>{outcome.trim()}</li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 2. Workstreams Formatter
// ============================================================================

export function WorkstreamsFormatter({ data }: { data: Workstream[] }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No workstreams defined</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((ws) => (
        <Card key={ws.id} className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <CardTitle className="text-base flex-1 min-w-0 break-words">{ws.name}</CardTitle>
              <Badge variant="outline" className="w-fit">
                {Math.round((ws.confidence || 0) * 100)}% confidence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 break-words">{ws.description}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <KeyValue 
              label="Timeline" 
              value={`Month ${ws.startMonth} - ${ws.endMonth} (${ws.endMonth - ws.startMonth + 1} months)`} 
            />
            {ws.owner && <KeyValue label="Owner" value={ws.owner} />}
            
            {ws.deliverables && ws.deliverables.length > 0 && (
              <div>
                <span className="text-sm font-medium">Deliverables:</span>
                <ul className="mt-2 space-y-1">
                  {ws.deliverables.map((d) => (
                    <li key={d.id} className="text-sm ml-4 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <span className="font-medium">{d.name}</span>
                        <span className="text-muted-foreground"> - {d.description}</span>
                        <span className="text-muted-foreground text-xs block">Due: Month {d.dueMonth} • {d.effort}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ws.dependencies && ws.dependencies.length > 0 && (
              <div>
                <span className="text-sm font-medium">Dependencies:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ws.dependencies.map((dep, i) => (
                    <Badge key={i} variant="secondary">{dep}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// 3. Timeline Formatter
// ============================================================================

export function TimelineFormatter({ data }: { data: Timeline }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-base px-4 py-2">
          <Calendar className="h-4 w-4 mr-2" />
          {data.totalMonths} Months Total
        </Badge>
      </div>

      <Section title="Phases" icon={Clock}>
        <div className="space-y-3">
          {data.phases.map((phase) => (
            <Card key={phase.phase}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge>{phase.phase}</Badge>
                  {phase.name}
                  <span className="text-xs text-muted-foreground font-normal ml-auto">
                    Months {phase.startMonth}-{phase.endMonth}
                  </span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{phase.description}</p>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium mb-2">Key Milestones:</div>
                <List items={phase.keyMilestones} />
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {data.criticalPath && data.criticalPath.length > 0 && (
        <Section title="Critical Path" icon={AlertTriangle}>
          <div className="flex flex-wrap gap-2">
            {data.criticalPath.map((item, i) => (
              <Badge key={i} variant="destructive">{item}</Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================================================
// 4. Resource Plan Formatter
// ============================================================================

export function ResourcePlanFormatter({ data }: { data: ResourcePlan }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-base px-4 py-2">
          <Users className="h-4 w-4 mr-2" />
          {data.totalFTEs} Total FTEs
        </Badge>
      </div>

      <Section title="Internal Team" icon={Users}>
        <div className="space-y-3">
          {data.internalTeam?.map((res, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="mb-3">
                  <div>
                    <h4 className="font-semibold break-words">{res.role}</h4>
                    <p className="text-sm text-muted-foreground">
                      {res.allocation}% allocation • {res.months} months
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Skills:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {res.skills.map((skill, j) => (
                        <Badge key={j} variant="secondary" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground italic">{res.justification}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {data.externalResources && data.externalResources.length > 0 && (
        <Section title="External Resources" icon={Building2}>
          <div className="space-y-2">
            {data.externalResources.map((ext, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <h4 className="font-semibold flex-1 min-w-0 break-words">{ext.type}</h4>
                    <Badge variant="outline" className="w-fit">${ext.estimatedCost.toLocaleString()}</Badge>
                  </div>
                  <p className="text-sm mb-1 break-words">{ext.description}</p>
                  <p className="text-xs text-muted-foreground">Timing: {ext.timing}</p>
                  <p className="text-sm italic text-muted-foreground mt-2 break-words">{ext.justification}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {data.criticalSkills && data.criticalSkills.length > 0 && (
        <Section title="Critical Skills" icon={Target}>
          <div className="flex flex-wrap gap-2">
            {data.criticalSkills.map((skill, i) => (
              <Badge key={i} variant="default">{skill}</Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================================================
// 5. Financial Plan Formatter
// ============================================================================

export function FinancialPlanFormatter({ data }: { data: FinancialPlan }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Budget</div>
            <div className="text-3xl font-bold text-primary">
              ${data.totalBudget.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Contingency ({data.contingencyPercentage}%)</div>
            <div className="text-3xl font-bold">
              ${data.contingency.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.costBreakdown && data.costBreakdown.length > 0 && (
        <Section title="Cost Breakdown" icon={DollarSign}>
          <div className="space-y-2">
            {data.costBreakdown.map((cost, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-muted rounded">
                <div className="flex-1 min-w-0">
                  <div className="font-medium break-words">{cost.category}</div>
                  <div className="text-sm text-muted-foreground break-words">{cost.description}</div>
                </div>
                <div className="text-left sm:text-right flex-shrink-0">
                  <div className="font-bold">${cost.amount.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{cost.percentage}%</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.cashFlow && data.cashFlow.length > 0 && (
        <Section title="Cash Flow" icon={TrendingUp}>
          <div className="space-y-2">
            {data.cashFlow.map((cf) => (
              <div key={cf.quarter} className="flex items-center justify-between p-2 border-b">
                <span className="font-medium">Q{cf.quarter}</span>
                <div className="text-right">
                  <div className={cf.amount < 0 ? "text-red-600" : "text-green-600"}>
                    ${Math.abs(cf.amount).toLocaleString()} {cf.amount < 0 ? "(out)" : "(in)"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Cumulative: ${cf.cumulative.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.assumptions && data.assumptions.length > 0 && (
        <Section title="Assumptions" icon={FileCheck}>
          <List items={data.assumptions} />
        </Section>
      )}
    </div>
  );
}

// ============================================================================
// 6. Benefits Realization Formatter
// ============================================================================

export function BenefitsRealizationFormatter({ data }: { data: BenefitsRealization }) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Financial': return 'bg-green-100 text-green-800';
      case 'Strategic': return 'bg-blue-100 text-blue-800';
      case 'Operational': return 'bg-purple-100 text-purple-800';
      case 'Risk Mitigation': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {(data.totalFinancialValue || data.roi || data.npv || data.paybackPeriod) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.totalFinancialValue && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Value</div>
                <div className="text-2xl font-bold">${data.totalFinancialValue.toLocaleString()}</div>
              </CardContent>
            </Card>
          )}
          {data.roi && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">ROI</div>
                <div className="text-2xl font-bold text-green-600">{data.roi}%</div>
              </CardContent>
            </Card>
          )}
          {data.npv && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">NPV</div>
                <div className="text-2xl font-bold">${data.npv.toLocaleString()}</div>
              </CardContent>
            </Card>
          )}
          {data.paybackPeriod && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Payback</div>
                <div className="text-2xl font-bold">{data.paybackPeriod} months</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Section title="Benefits" icon={Target}>
        <div className="space-y-3">
          {data.benefits.map((benefit) => (
            <Card key={benefit.id}>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <Badge className={getCategoryColor(benefit.category)}>
                    {benefit.category}
                  </Badge>
                  <div className="text-left sm:text-right">
                    <Badge variant="outline">
                      {Math.round((benefit.confidence || 0) * 100)}% confidence
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Realized: Month {benefit.realizationMonth}
                    </div>
                  </div>
                </div>
                <p className="text-sm mb-2 break-words">{benefit.description}</p>
                {benefit.estimatedValue && (
                  <div className="text-sm font-semibold text-green-600">
                    Value: ${benefit.estimatedValue.toLocaleString()}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Measurement:</span> {benefit.measurement}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ============================================================================
// 7. Risk Register Formatter
// ============================================================================

export function RiskRegisterFormatter({ data }: { data: RiskRegister }) {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {data.topRisks && data.topRisks.length > 0 && (
        <Section title="Top Risks" icon={AlertTriangle}>
          <div className="space-y-3">
            {data.topRisks.map((risk) => (
              <Card key={risk.id} className={`border-2 ${getImpactColor(risk.impact)}`}>
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                    <Badge className={getImpactColor(risk.impact)}>{risk.impact} Impact</Badge>
                    <div className="text-left sm:text-right">
                      <div className="text-sm font-semibold">Probability: {risk.probability}%</div>
                      <div className="text-xs text-muted-foreground">Severity: {risk.severity}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium text-sm">Risk:</span>
                      <p className="text-sm break-words">{risk.description}</p>
                    </div>
                    <div>
                      <span className="font-medium text-sm">Category:</span>
                      <Badge variant="outline" className="ml-2">{risk.category}</Badge>
                    </div>
                    <div>
                      <span className="font-medium text-sm">Mitigation:</span>
                      <p className="text-sm text-muted-foreground break-words">{risk.mitigation}</p>
                    </div>
                    <div>
                      <span className="font-medium text-sm">Contingency:</span>
                      <p className="text-sm text-muted-foreground break-words">{risk.contingency}</p>
                    </div>
                    {risk.owner && (
                      <div className="text-sm">
                        <span className="font-medium">Owner:</span> {risk.owner}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {data.risks && data.risks.length > data.topRisks.length && (
        <Section title="All Risks" icon={FileCheck}>
          <div className="text-sm text-muted-foreground">
            {data.risks.length} total risks identified ({data.topRisks.length} shown above as top priority)
          </div>
        </Section>
      )}

      {data.mitigationBudget && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Risk Mitigation Budget</div>
            <div className="text-2xl font-bold">${data.mitigationBudget.toLocaleString()}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// 8. Stage Gates Formatter
// ============================================================================

export function StageGatesFormatter({ data }: { data: StageGates }) {
  return (
    <div className="space-y-4">
      {data.gates.map((gate) => (
        <Card key={gate.gate} className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Flag className="h-5 w-5 flex-shrink-0" />
                <span className="break-words">Gate {gate.gate}: {gate.name}</span>
              </div>
              <Badge variant="outline" className="w-fit">Month {gate.month}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2 text-green-700">✓ Go Criteria</h4>
              <List items={gate.goCriteria} />
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2 text-red-700">✗ No-Go Triggers</h4>
              <List items={gate.noGoTriggers} />
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Required Deliverables</h4>
              <List items={gate.deliverables} />
            </div>

            <div className="pt-2 border-t">
              <Badge variant="outline">
                {Math.round((gate.confidence || 0) * 100)}% confidence
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// 9. KPIs Formatter
// ============================================================================

export function KPIsFormatter({ data }: { data: KPIs }) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Financial': return 'bg-green-100 text-green-800';
      case 'Operational': return 'bg-blue-100 text-blue-800';
      case 'Strategic': return 'bg-purple-100 text-purple-800';
      case 'Customer': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle undefined/null kpis array
  const kpis = data?.kpis || [];
  
  if (kpis.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No KPIs defined yet.</p>
        <p className="text-sm">KPIs will be generated during program refinement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {kpis.map((kpi) => (
        <Card key={kpi.id}>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="font-semibold break-words">{kpi.name}</h4>
                  <Badge className={getCategoryColor(kpi.category)}>{kpi.category}</Badge>
                </div>
                {kpi.owner && (
                  <div className="text-sm text-muted-foreground break-words">Owner: {kpi.owner}</div>
                )}
              </div>
              <Badge variant="outline" className="w-fit">
                {Math.round((kpi.confidence || 0) * 100)}% confidence
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-xs text-muted-foreground">Baseline</div>
                <div className="font-semibold">{kpi.baseline}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Target</div>
                <div className="font-semibold text-green-600">{kpi.target}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Frequency</div>
                <div className="font-semibold">{kpi.frequency}</div>
              </div>
            </div>

            <div className="text-sm">
              <span className="font-medium">Measurement:</span>
              <span className="text-muted-foreground ml-2 break-words">{kpi.measurement}</span>
            </div>

            {kpi.linkedBenefitIds && kpi.linkedBenefitIds.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Linked to {kpi.linkedBenefitIds.length} benefit(s)
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// 10. Stakeholder Map Formatter
// ============================================================================

export function StakeholderMapFormatter({ data }: { data: StakeholderMap }) {
  const getQuadrant = (power: string, interest: string) => {
    if (power === 'High' && interest === 'High') return { label: 'Manage Closely', color: 'bg-red-100 text-red-800' };
    if (power === 'High' && interest !== 'High') return { label: 'Keep Satisfied', color: 'bg-orange-100 text-orange-800' };
    if (power !== 'High' && interest === 'High') return { label: 'Keep Informed', color: 'bg-blue-100 text-blue-800' };
    return { label: 'Monitor', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="space-y-6">
      <Section title="Stakeholders" icon={Users}>
        <div className="space-y-3">
          {data.stakeholders.map((stakeholder, i) => {
            const quadrant = getQuadrant(stakeholder.power, stakeholder.interest);
            return (
              <Card key={i}>
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold break-words">{stakeholder.name}</h4>
                      <div className="text-sm text-muted-foreground break-words">{stakeholder.group}</div>
                    </div>
                    <Badge className={`${quadrant.color} w-fit`}>{quadrant.label}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Power:</span>
                      <Badge variant="outline" className="ml-2">{stakeholder.power}</Badge>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Interest:</span>
                      <Badge variant="outline" className="ml-2">{stakeholder.interest}</Badge>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Engagement Strategy:</span>
                      <p className="text-muted-foreground break-words">{stakeholder.engagement}</p>
                    </div>
                    <div>
                      <span className="font-medium">Communication Plan:</span>
                      <p className="text-muted-foreground break-words">{stakeholder.communicationPlan}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      {data.changeManagement && data.changeManagement.length > 0 && (
        <Section title="Change Management" icon={TrendingUp}>
          <div className="space-y-2">
            {data.changeManagement.map((phase, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <div className="font-semibold mb-1">{phase.phase}</div>
                  <div className="text-sm text-muted-foreground mb-2">{phase.months}</div>
                  <List items={phase.activities} />
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total Impacted Groups</div>
          <div className="text-3xl font-bold">{data.impactedGroups}</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 11. Governance Formatter
// ============================================================================

export function GovernanceFormatter({ data }: { data: Governance }) {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Strategic': return 'bg-purple-100 text-purple-800';
      case 'Tactical': return 'bg-blue-100 text-blue-800';
      case 'Execution': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Governance Bodies" icon={Building2}>
        <div className="space-y-3">
          {data.bodies.map((body, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <span className="break-words">{body.name}</span>
                  <Badge className={getLevelColor(body.level)}>{body.level}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm font-medium">Members:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {body.members.map((member, j) => (
                      <Badge key={j} variant="outline">{member}</Badge>
                    ))}
                  </div>
                </div>
                
                <KeyValue label="Cadence" value={body.cadence} />
                
                <div>
                  <span className="text-sm font-medium">Responsibilities:</span>
                  <List items={body.responsibilities} />
                </div>

                <KeyValue label="Escalation Path" value={body.escalationPath} />
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Decision Rights (RACI)" icon={CheckCircle2}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[600px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Decision</th>
                  <th className="text-left p-2">Responsible</th>
                  <th className="text-left p-2">Accountable</th>
                  <th className="text-left p-2">Consulted</th>
                  <th className="text-left p-2">Informed</th>
                </tr>
              </thead>
              <tbody>
                {data.decisionRights.map((right, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 font-medium break-words">{right.decision}</td>
                    <td className="p-2 break-words">{right.responsible}</td>
                    <td className="p-2 break-words">{right.accountable}</td>
                    <td className="p-2 break-words">{right.consulted}</td>
                    <td className="p-2 break-words">{right.informed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 sm:hidden">Scroll horizontally to view all columns →</p>
      </Section>

      {data.meetingCadence && Object.keys(data.meetingCadence).length > 0 && (
        <Section title="Meeting Cadence" icon={Calendar}>
          <div className="space-y-1">
            {Object.entries(data.meetingCadence).map(([meeting, cadence], i) => (
              <KeyValue key={i} label={meeting} value={cadence} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================================================
// 12. QA Plan Formatter
// ============================================================================

export function QAPlanFormatter({ data }: { data: QAPlan }) {
  return (
    <div className="space-y-6">
      <Section title="Quality Standards" icon={CheckCircle2}>
        <div className="space-y-3">
          {data.standards.map((standard, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-base">{standard.area}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <KeyValue label="Standard" value={standard.standard} />
                <div>
                  <span className="text-sm font-medium">Acceptance Criteria:</span>
                  <List items={standard.acceptanceCriteria} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Quality Processes" icon={FileCheck}>
        <div className="space-y-3">
          {data.processes.map((process, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-base">{process.phase}</CardTitle>
              </CardHeader>
              <CardContent>
                <List items={process.activities} />
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Overall Acceptance Criteria" icon={Target}>
        <List items={data.acceptanceCriteria} />
      </Section>
    </div>
  );
}

// ============================================================================
// 13. Procurement Formatter
// ============================================================================

export function ProcurementFormatter({ data }: { data: Procurement }) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Software': return 'bg-blue-100 text-blue-800';
      case 'Services': return 'bg-green-100 text-green-800';
      case 'Hardware': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total Procurement Value</div>
          <div className="text-3xl font-bold">${data.totalProcurementValue.toLocaleString()}</div>
        </CardContent>
      </Card>

      <Section title="Procurement Items" icon={ShoppingCart}>
        <div className="space-y-3">
          {data.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold break-words mb-2">{item.name}</h4>
                    <Badge className={getTypeColor(item.type)}>{item.type}</Badge>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className="font-bold text-lg">${item.estimatedValue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{item.timing}</div>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <KeyValue label="Purpose" value={item.purpose} />
                  <KeyValue label="Approval Required" value={item.approvalRequired} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {data.vendorManagement && data.vendorManagement.length > 0 && (
        <Section title="Vendor Management" icon={Building2}>
          <List items={data.vendorManagement} />
        </Section>
      )}

      {data.policies && data.policies.length > 0 && (
        <Section title="Procurement Policies" icon={FileCheck}>
          <List items={data.policies} />
        </Section>
      )}
    </div>
  );
}

// ============================================================================
// 14. Exit Strategy Formatter
// ============================================================================

export function ExitStrategyFormatter({ data }: { data: ExitStrategy }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Failure Conditions" icon={AlertTriangle}>
        <div className="space-y-2">
          {data.failureConditions.map((condition, i) => (
            <Card key={i} className={`border-2 ${getSeverityColor(condition.severity)}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <Badge className={getSeverityColor(condition.severity)}>
                    {condition.severity}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Response: {condition.responseTime}
                  </span>
                </div>
                <p className="text-sm">{condition.trigger}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Rollback Procedures" icon={LogOut}>
        <div className="space-y-3">
          {data.rollbackProcedures.map((procedure, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="break-words flex-1 min-w-0">{procedure.name}</span>
                  <Badge variant="outline" className="w-fit">${procedure.estimatedCost.toLocaleString()}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <KeyValue label="Trigger" value={procedure.trigger} />
                <KeyValue label="Timeline" value={procedure.timeline} />
                <div>
                  <span className="text-sm font-medium">Actions:</span>
                  <List items={procedure.actions} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {data.pivotOptions && data.pivotOptions.length > 0 && (
        <Section title="Pivot Options" icon={TrendingUp}>
          <div className="space-y-3">
            {data.pivotOptions.map((pivot, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-base">{pivot.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm break-words">{pivot.description}</p>
                  <div>
                    <span className="text-sm font-medium">Conditions:</span>
                    <List items={pivot.conditions} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {data.lessonsLearned && data.lessonsLearned.length > 0 && (
        <Section title="Lessons Learned Framework" icon={FileCheck}>
          <List items={data.lessonsLearned} />
        </Section>
      )}
    </div>
  );
}
