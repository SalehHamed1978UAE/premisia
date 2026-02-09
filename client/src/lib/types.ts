export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
  }[];
}

export interface MetricCard {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  target?: string | number;
  status: 'on-track' | 'at-risk' | 'delayed' | 'good';
}

export interface RiskMatrixCell {
  likelihood: string;
  impact: string;
  count: number;
  risks?: string[];
}

export interface BenefitCategory {
  name: string;
  targetValue: number;
  realizedValue: number;
  progress: number;
  color: string;
}

export interface ExpenseCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}
