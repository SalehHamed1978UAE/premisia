#!/usr/bin/env tsx

/**
 * Master ETL script to load all seed data into the Knowledge Graph
 * Runs all individual ETL scripts in the correct order
 */

import { loadOrganizations } from './organizations.js';
import { loadLocations } from './locations.js';
import { loadJurisdictions } from './jurisdictions.js';
import { loadIndustries } from './industries.js';
import { loadIncentives } from './incentives.js';
import { loadRegulations } from './regulations.js';

async function loadAll() {
  console.log('========================================');
  console.log('Knowledge Graph - Load All Seed Data');
  console.log('========================================\n');

  try {
    // Load in dependency order
    console.log('Step 1: Loading Organizations...');
    await loadOrganizations();
    console.log('');

    console.log('Step 2: Loading Locations...');
    await loadLocations();
    console.log('');

    console.log('Step 3: Loading Jurisdictions...');
    await loadJurisdictions();
    console.log('');

    console.log('Step 4: Loading Industries...');
    await loadIndustries();
    console.log('');

    console.log('Step 5: Loading Incentives...');
    await loadIncentives();
    console.log('');

    console.log('Step 6: Loading Regulations...');
    await loadRegulations();
    console.log('');

    console.log('========================================');
    console.log('✓ All seed data loaded successfully!');
    console.log('========================================');

  } catch (error) {
    console.error('\n========================================');
    console.error('✗ ETL failed:', error);
    console.error('========================================');
    process.exit(1);
  }
}

// Run if called directly
loadAll()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { loadAll };
