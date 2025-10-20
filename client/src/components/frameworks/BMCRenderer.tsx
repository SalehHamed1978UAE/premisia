import type { FC } from 'react';
import type { BMCFrameworkResult } from '@shared/framework-types';
import { Card } from "@/components/ui/card";
import type { FrameworkRendererProps } from './index';

// This will be populated with the actual BMC rendering logic from BMCResultsPage.tsx
const BMCRenderer: FC<FrameworkRendererProps<BMCFrameworkResult>> = ({ data }) => {
  return (
    <Card className="p-6" data-testid="framework-bmc">
      <h2 className="text-2xl font-bold mb-4">📊 Business Model Canvas</h2>
      <p className="text-muted-foreground">BMC renderer will be implemented in task 3</p>
      <pre className="mt-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </Card>
  );
};

export default BMCRenderer;
