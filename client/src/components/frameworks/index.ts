/**
 * Framework Renderer Registry
 * 
 * Maps framework names to their React renderer components.
 * To add a new framework:
 * 1. Create a renderer component (e.g., SWOTRenderer.tsx)
 * 2. Import it here
 * 3. Add it to the registry
 */

import type { FrameworkName } from '@shared/framework-types';
import type { FC } from 'react';

// Import renderers
import BMCRenderer from './BMCRenderer';
import PortersRenderer from './PortersRenderer';
import FiveWhysRenderer from './FiveWhysRenderer';

/**
 * Framework Renderer Component Type
 * All renderers must accept framework data as props
 */
export interface FrameworkRendererProps<T = any> {
  data: T;
  sessionId?: string;
  versionNumber?: number;
}

export type FrameworkRenderer = FC<FrameworkRendererProps>;

/**
 * Framework Renderer Registry
 * Maps framework names to their renderer components
 */
export const FRAMEWORK_RENDERERS: Partial<Record<FrameworkName, FrameworkRenderer>> = {
  bmc: BMCRenderer,
  porters: PortersRenderer,
  five_whys: FiveWhysRenderer,
  // Add more frameworks as they're implemented:
  // pestle: PESTLERenderer,
  // swot: SWOTRenderer,
  // ansoff: AnsoffRenderer,
  // blue_ocean: BlueOceanRenderer,
};

/**
 * Get renderer for a framework
 */
export function getFrameworkRenderer(framework: FrameworkName): FrameworkRenderer | null {
  return FRAMEWORK_RENDERERS[framework] || null;
}

/**
 * Check if a framework has a renderer
 */
export function hasFrameworkRenderer(framework: FrameworkName): boolean {
  return framework in FRAMEWORK_RENDERERS;
}
