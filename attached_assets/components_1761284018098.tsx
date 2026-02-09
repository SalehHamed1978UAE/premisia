/**
 * @module planning/react/components
 * React components for planning system UI
 */

import React, { useState, useEffect } from 'react';
import { useProjectPlanner, useStrategyAdjustments } from './hooks';
import { PlanningRequest } from '../orchestrator';

// ============================================
// PLANNING PROGRESS COMPONENT
// ============================================

export const PlanningProgress: React.FC<{
  progress: Array<{
    name: string;
    status: 'pending' | 'running' | 'complete' | 'failed';
    duration?: number;
  }>;
  currentStep?: string;
  score?: number;
  iterations?: number;
}> = ({ progress, currentStep, score, iterations }) => {
  return (
    <div className="planning-progress">
      <div className="progress-header">
        <h3>Generating Intelligent Schedule</h3>
        {score && (
          <div className="progress-stats">
            <span>Score: {score.toFixed(0)}%</span>
            <span>Iterations: {iterations}</span>
          </div>
        )}
      </div>
      
      <div className="progress-steps">
        {progress.map((step, index) => (
          <div key={index} className={`progress-step ${step.status}`}>
            <div className="step-indicator">
              {step.status === 'complete' && '✓'}
              {step.status === 'running' && '⟳'}
              {step.status === 'failed' && '✗'}
              {step.status === 'pending' && '○'}
            </div>
            
            <div className="step-content">
              <div className="step-name">{step.name}</div>
              {step.duration && (
                <div className="step-duration">{step.duration}ms</div>
              )}
            </div>
            
            {step.status === 'running' && (
              <div className="step-spinner" />
            )}
          </div>
        ))}
      </div>
      
      {currentStep && (
        <div className="current-step-message">
          {currentStep}...
        </div>
      )}
    </div>
  );
};

// ============================================
// STRATEGY ADJUSTMENTS COMPONENT
// ============================================

export const StrategyAdjustments: React.FC<{
  adjustments: string[];
  onAccept?: (adjustments: string[]) => void;
  onReject?: () => void;
}> = ({ adjustments, onAccept, onReject }) => {
  const {
    acceptAdjustment,
    rejectAdjustment,
    getAdjustmentStatus,
    getAcceptedAdjustments
  } = useStrategyAdjustments(adjustments);
  
  const handleAcceptAll = () => {
    adjustments.forEach((_, i) => acceptAdjustment(i));
    onAccept?.(adjustments);
  };
  
  const handleAcceptSelected = () => {
    onAccept?.(getAcceptedAdjustments());
  };
  
  return (
    <div className="strategy-adjustments">
      <div className="adjustments-header">
        <h3>Strategy Adjustments Needed</h3>
        <p>The following changes are required to create a feasible plan:</p>
      </div>
      
      <div className="adjustments-list">
        {adjustments.map((adjustment, index) => {
          const status = getAdjustmentStatus(index);
          const [type, ...rest] = adjustment.split(':');
          const description = rest.join(':').trim();
          
          return (
            <div key={index} className={`adjustment-item ${status}`}>
              <div className="adjustment-type">
                <span className={`type-badge ${type.toLowerCase()}`}>
                  {type}
                </span>
              </div>
              
              <div className="adjustment-content">
                <div className="adjustment-description">
                  {description}
                </div>
                
                <div className="adjustment-actions">
                  <button
                    className={`btn-small ${status === 'accepted' ? 'active' : ''}`}
                    onClick={() => acceptAdjustment(index)}
                  >
                    Accept
                  </button>
                  <button
                    className={`btn-small ${status === 'rejected' ? 'active' : ''}`}
                    onClick={() => rejectAdjustment(index)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="adjustments-actions">
        <button className="btn-primary" onClick={handleAcceptAll}>
          Accept All Adjustments
        </button>
        <button className="btn-secondary" onClick={handleAcceptSelected}>
          Accept Selected
        </button>
        <button className="btn-tertiary" onClick={onReject}>
          Keep Original Strategy
        </button>
      </div>
    </div>
  );
};

// ============================================
// PLANNING DASHBOARD COMPONENT
// ============================================

export const PlanningDashboard: React.FC<{
  epmProgram: any;
  businessContext: any;
  onComplete: (result: any) => void;
}> = ({ epmProgram, businessContext, onComplete }) => {
  const {
    plan,
    status,
    result,
    error,
    progress,
    currentStep,
    iterations,
    score,
    reset
  } = useProjectPlanner();
  
  const [showAdjustments, setShowAdjustments] = useState(false);
  
  const handleStartPlanning = async () => {
    const request: PlanningRequest = {
      strategy: {
        workstreams: epmProgram.workstreams,
        objectives: epmProgram.executiveSummary?.objectives,
        context: businessContext
      },
      constraints: [
        {
          id: 'timeline',
          type: 'deadline',
          description: 'Complete within 12 months',
          value: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
          isHard: false
        }
      ],
      resources: [
        {
          id: 'team',
          name: 'Development Team',
          capacity: 5,
          skills: ['development'],
          availability: [{
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            percentAvailable: 1.0
          }],
          costPerUnit: 150000
        }
      ],
      options: {
        enableOptimization: true,
        enableResourceLeveling: true
      }
    };
    
    try {
      const planResult = await plan(request);
      
      if (planResult.success) {
        onComplete(planResult);
      } else if (planResult.strategyAdjustments?.length > 0) {
        setShowAdjustments(true);
      }
    } catch (err) {
      console.error('Planning failed:', err);
    }
  };
  
  const handleAcceptAdjustments = (accepted: string[]) => {
    // Apply accepted adjustments and replan
    console.log('Accepted adjustments:', accepted);
    onComplete({ ...result, adjustmentsApplied: accepted });
  };
  
  const handleRejectAdjustments = () => {
    // Use original plan despite issues
    onComplete({ ...result, adjustmentsRejected: true });
  };
  
  return (
    <div className="planning-dashboard">
      {status === 'idle' && (
        <div className="planning-start">
          <h2>Intelligent Project Planning</h2>
          <p>Generate an optimized, validated project schedule using AI</p>
          
          <div className="planning-features">
            <div className="feature">
              <span className="feature-icon">🧠</span>
              <h4>AI-Powered</h4>
              <p>Uses LLMs to understand dependencies and constraints</p>
            </div>
            
            <div className="feature">
              <span className="feature-icon">🔄</span>
              <h4>Iterative Optimization</h4>
              <p>Continuously improves until optimal schedule found</p>
            </div>
            
            <div className="feature">
              <span className="feature-icon">✅</span>
              <h4>Validated Output</h4>
              <p>Ensures logical coherence and feasibility</p>
            </div>
          </div>
          
          <button className="btn-primary btn-large" onClick={handleStartPlanning}>
            Generate Intelligent Schedule
          </button>
        </div>
      )}
      
      {status === 'planning' && (
        <PlanningProgress
          progress={progress}
          currentStep={currentStep}
          score={score}
          iterations={iterations}
        />
      )}
      
      {status === 'success' && showAdjustments && result?.strategyAdjustments && (
        <StrategyAdjustments
          adjustments={result.strategyAdjustments}
          onAccept={handleAcceptAdjustments}
          onReject={handleRejectAdjustments}
        />
      )}
      
      {status === 'success' && !showAdjustments && (
        <div className="planning-success">
          <div className="success-icon">✓</div>
          <h3>Schedule Generated Successfully</h3>
          
          <div className="success-stats">
            <div className="stat">
              <span className="stat-value">{result?.metadata.score}%</span>
              <span className="stat-label">Confidence Score</span>
            </div>
            <div className="stat">
              <span className="stat-value">{result?.metadata.iterations}</span>
              <span className="stat-label">Optimization Iterations</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {(result?.metadata.duration || 0) / 1000}s
              </span>
              <span className="stat-label">Generation Time</span>
            </div>
          </div>
          
          <button className="btn-primary" onClick={() => onComplete(result)}>
            Use This Schedule
          </button>
        </div>
      )}
      
      {status === 'error' && (
        <div className="planning-error">
          <div className="error-icon">✗</div>
          <h3>Planning Failed</h3>
          <p className="error-message">{error?.message}</p>
          
          <div className="error-actions">
            <button className="btn-primary" onClick={reset}>
              Try Again
            </button>
            <button className="btn-secondary" onClick={() => onComplete(null)}>
              Use Basic Timeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// RATIONALIZATION DISPLAY COMPONENT
// ============================================

export const RationalizationDisplay: React.FC<{
  report: {
    logicalCoherence: number;
    reasoning: string[];
    assumptions: string[];
    risks: Array<{
      description: string;
      likelihood: string;
      impact: string;
      mitigation: string;
    }>;
    opportunities: Array<{
      description: string;
      benefit: string;
      effort: string;
      recommendation: string;
    }>;
    criticalInsights: string[];
  };
}> = ({ report }) => {
  const [activeTab, setActiveTab] = useState('reasoning');
  
  return (
    <div className="rationalization-display">
      <div className="coherence-score">
        <div className="score-circle">
          <svg viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="5"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#4caf50"
              strokeWidth="5"
              strokeDasharray={`${report.logicalCoherence * 2.83} 283`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="score-text">
            {report.logicalCoherence}%
          </div>
        </div>
        <h4>Logical Coherence</h4>
      </div>
      
      <div className="rationalization-tabs">
        <button
          className={activeTab === 'reasoning' ? 'active' : ''}
          onClick={() => setActiveTab('reasoning')}
        >
          Reasoning
        </button>
        <button
          className={activeTab === 'assumptions' ? 'active' : ''}
          onClick={() => setActiveTab('assumptions')}
        >
          Assumptions
        </button>
        <button
          className={activeTab === 'risks' ? 'active' : ''}
          onClick={() => setActiveTab('risks')}
        >
          Risks
        </button>
        <button
          className={activeTab === 'opportunities' ? 'active' : ''}
          onClick={() => setActiveTab('opportunities')}
        >
          Opportunities
        </button>
        <button
          className={activeTab === 'insights' ? 'active' : ''}
          onClick={() => setActiveTab('insights')}
        >
          Insights
        </button>
      </div>
      
      <div className="rationalization-content">
        {activeTab === 'reasoning' && (
          <ul className="reasoning-list">
            {report.reasoning.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )}
        
        {activeTab === 'assumptions' && (
          <ul className="assumptions-list">
            {report.assumptions.map((assumption, i) => (
              <li key={i}>{assumption}</li>
            ))}
          </ul>
        )}
        
        {activeTab === 'risks' && (
          <div className="risks-grid">
            {report.risks.map((risk, i) => (
              <div key={i} className="risk-card">
                <div className="risk-header">
                  <span className={`likelihood ${risk.likelihood}`}>
                    {risk.likelihood}
                  </span>
                  <span className={`impact ${risk.impact}`}>
                    {risk.impact}
                  </span>
                </div>
                <p className="risk-description">{risk.description}</p>
                <p className="risk-mitigation">
                  <strong>Mitigation:</strong> {risk.mitigation}
                </p>
              </div>
            ))}
          </div>
        )}
        
        {activeTab === 'opportunities' && (
          <div className="opportunities-list">
            {report.opportunities.map((opp, i) => (
              <div key={i} className="opportunity-item">
                <h4>{opp.description}</h4>
                <p><strong>Benefit:</strong> {opp.benefit}</p>
                <p><strong>Effort:</strong> {opp.effort}</p>
                <p><strong>Recommendation:</strong> {opp.recommendation}</p>
              </div>
            ))}
          </div>
        )}
        
        {activeTab === 'insights' && (
          <div className="insights-list">
            {report.criticalInsights.map((insight, i) => (
              <div key={i} className="insight-item">
                <span className="insight-icon">💡</span>
                <p>{insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
