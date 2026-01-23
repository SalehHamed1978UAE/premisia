/**
 * Module Manifests Index
 * Exports all module manifests for registration
 */

export { bmcAnalyzerManifest } from './bmc-analyzer';
export { portersAnalyzerManifest } from './porters-analyzer';
export { pestleAnalyzerManifest } from './pestle-analyzer';
export { fiveWhysAnalyzerManifest } from './five-whys-analyzer';
export { epmGeneratorManifest } from './epm-generator';
export { inputProcessorManifest } from './input-processor';

import { bmcAnalyzerManifest } from './bmc-analyzer';
import { portersAnalyzerManifest } from './porters-analyzer';
import { pestleAnalyzerManifest } from './pestle-analyzer';
import { fiveWhysAnalyzerManifest } from './five-whys-analyzer';
import { epmGeneratorManifest } from './epm-generator';
import { inputProcessorManifest } from './input-processor';
import type { ModuleManifest } from '../manifest';

export const allManifests: ModuleManifest[] = [
  inputProcessorManifest,
  fiveWhysAnalyzerManifest,
  bmcAnalyzerManifest,
  portersAnalyzerManifest,
  pestleAnalyzerManifest,
  epmGeneratorManifest,
];
