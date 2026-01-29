/**
 * Bridge Registry Index
 * 
 * Exports all bridges and ensures they're registered at import time.
 */

// Import bridges (they self-register on import)
export * from './whys-to-bmc-bridge';
export * from './pestle-to-porters-bridge';
export * from './porters-to-swot-bridge';

// Re-export bridge utilities
export { 
  registerBridge, 
  getBridge, 
  listBridges, 
  hasBridge 
} from '@shared/contracts/bridge.contract';
