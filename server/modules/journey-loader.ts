/**
 * Journey Loader
 * Loads journey configs from YAML files at startup
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { JourneyConfig, JourneyConfigYaml, yamlToJourneyConfig } from './journey-config';

const JOURNEYS_DIR = join(process.cwd(), 'server', 'modules', 'journeys');

export function loadJourneyConfigs(): JourneyConfig[] {
  const configs: JourneyConfig[] = [];
  
  try {
    const files = readdirSync(JOURNEYS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    
    for (const file of files) {
      try {
        const filePath = join(JOURNEYS_DIR, file);
        const content = readFileSync(filePath, 'utf-8');
        const yamlConfig = yaml.load(content) as JourneyConfigYaml;
        const config = yamlToJourneyConfig(yamlConfig);
        configs.push(config);
        console.log(`[JourneyLoader] Loaded journey config: ${config.id} from ${file}`);
      } catch (err) {
        console.error(`[JourneyLoader] Failed to load journey from ${file}:`, err);
      }
    }
  } catch (err) {
    console.warn(`[JourneyLoader] Journeys directory not found or empty: ${JOURNEYS_DIR}`);
  }
  
  return configs;
}
