import { cn } from "@/lib/utils";

interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Chart({ children, className, ...props }: ChartProps) {
  return (
    <div
      className={cn("w-full h-full min-h-[200px]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ChartContainer({ children, className, ...props }: ChartContainerProps) {
  return (
    <div
      className={cn("relative w-full h-full", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ChartTooltip({ children }: { children: React.ReactNode }) {
  return <div className="chart-tooltip">{children}</div>;
}

export function ChartLegend({ children }: { children: React.ReactNode }) {
  return <div className="chart-legend">{children}</div>;
}
