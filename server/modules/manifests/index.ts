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
export { swotAnalyzerManifest } from './swot-analyzer';
export { segmentDiscoveryAnalyzerManifest } from './segment-discovery-analyzer';
export { competitivePositioningAnalyzerManifest } from './competitive-positioning-analyzer';
export { ansoffAnalyzerManifest } from './ansoff-analyzer';
export { blueOceanAnalyzerManifest } from './blue-ocean-analyzer';
export { oceanStrategyAnalyzerManifest } from './ocean-strategy-analyzer';
export { bcgMatrixAnalyzerManifest } from './bcg-matrix-analyzer';
export { valueChainAnalyzerManifest } from './value-chain-analyzer';
export { vrioAnalyzerManifest } from './vrio-analyzer';
export { scenarioPlanningAnalyzerManifest } from './scenario-planning-analyzer';
export { jobsToBeDoneAnalyzerManifest } from './jobs-to-be-done-analyzer';
export { okrGeneratorManifest } from './okr-generator';
export { strategicDecisionsManifest } from './strategic-decisions';
export { strategicUnderstandingManifest } from './strategic-understanding';

import { bmcAnalyzerManifest } from './bmc-analyzer';
import { portersAnalyzerManifest } from './porters-analyzer';
import { pestleAnalyzerManifest } from './pestle-analyzer';
import { fiveWhysAnalyzerManifest } from './five-whys-analyzer';
import { epmGeneratorManifest } from './epm-generator';
import { inputProcessorManifest } from './input-processor';
import { swotAnalyzerManifest } from './swot-analyzer';
import { segmentDiscoveryAnalyzerManifest } from './segment-discovery-analyzer';
import { competitivePositioningAnalyzerManifest } from './competitive-positioning-analyzer';
import { ansoffAnalyzerManifest } from './ansoff-analyzer';
import { blueOceanAnalyzerManifest } from './blue-ocean-analyzer';
import { oceanStrategyAnalyzerManifest } from './ocean-strategy-analyzer';
import { bcgMatrixAnalyzerManifest } from './bcg-matrix-analyzer';
import { valueChainAnalyzerManifest } from './value-chain-analyzer';
import { vrioAnalyzerManifest } from './vrio-analyzer';
import { scenarioPlanningAnalyzerManifest } from './scenario-planning-analyzer';
import { jobsToBeDoneAnalyzerManifest } from './jobs-to-be-done-analyzer';
import { okrGeneratorManifest } from './okr-generator';
import { strategicDecisionsManifest } from './strategic-decisions';
import { strategicUnderstandingManifest } from './strategic-understanding';
import type { ModuleManifest } from '../manifest';

export const allManifests: ModuleManifest[] = [
  inputProcessorManifest,
  strategicUnderstandingManifest,
  fiveWhysAnalyzerManifest,
  bmcAnalyzerManifest,
  portersAnalyzerManifest,
  pestleAnalyzerManifest,
  swotAnalyzerManifest,
  segmentDiscoveryAnalyzerManifest,
  competitivePositioningAnalyzerManifest,
  ansoffAnalyzerManifest,
  blueOceanAnalyzerManifest,
  oceanStrategyAnalyzerManifest,
  bcgMatrixAnalyzerManifest,
  valueChainAnalyzerManifest,
  vrioAnalyzerManifest,
  scenarioPlanningAnalyzerManifest,
  jobsToBeDoneAnalyzerManifest,
  okrGeneratorManifest,
  epmGeneratorManifest,
  strategicDecisionsManifest,
];
