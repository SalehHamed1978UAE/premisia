/**
 * Bridge Registry Index
 * 
 * Exports all bridges and ensures they're registered at import time.
 */

// Import bridges (they self-register on import)
export * from './whys-to-bmc-bridge';
export * from './pestle-to-porters-bridge';
export * from './porters-to-swot-bridge';
export * from './whys-to-swot-bridge';
export * from './swot-to-bmc-bridge';
export * from './porters-to-bmc-bridge';
export * from './bmc-to-blueocean-bridge';
export * from './pestle-to-bmc-bridge';
export * from './bmc-to-ansoff-bridge';
export * from './pestle-to-ansoff-bridge';
export * from './ansoff-to-bmc-bridge';

// Re-export bridge utilities
export { 
  registerBridge, 
  getBridge, 
  listBridges, 
  hasBridge 
} from '@shared/contracts/bridge.contract';
