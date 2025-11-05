// Decision Support Knowledge Graph Schema v1.0
// Core constraints and indexes for all node types

// =====================================
// CORE DOMAIN CONSTRAINTS
// =====================================

// Location nodes (districts, jurisdictions, emirates)
CREATE CONSTRAINT location_id IF NOT EXISTS FOR (n:Location) REQUIRE n.id IS UNIQUE;

// Jurisdictions (mainland, free zones)
CREATE CONSTRAINT jurisdiction_id IF NOT EXISTS FOR (n:Jurisdiction) REQUIRE n.id IS UNIQUE;

// Industries (F&B, retail, software, etc.)
CREATE CONSTRAINT industry_id IF NOT EXISTS FOR (n:Industry) REQUIRE n.id IS UNIQUE;

// Incentives (ADDED, ADIO, Dubai DED programs)
CREATE CONSTRAINT incentive_id IF NOT EXISTS FOR (n:Incentive) REQUIRE n.id IS UNIQUE;

// Regulations (PDPL, Emiratisation, etc.)
CREATE CONSTRAINT regulation_id IF NOT EXISTS FOR (n:Regulation) REQUIRE n.id IS UNIQUE;

// References (source documents, links)
CREATE CONSTRAINT reference_id IF NOT EXISTS FOR (n:Reference) REQUIRE n.id IS UNIQUE;

// Organizations (government bodies, authorities)
CREATE CONSTRAINT organization_id IF NOT EXISTS FOR (n:Organization) REQUIRE n.id IS UNIQUE;

// =====================================
// JOURNEY SESSION CONSTRAINTS
// =====================================

// Journey sessions (user planning sessions)
CREATE CONSTRAINT journey_id IF NOT EXISTS FOR (n:JourneySession) REQUIRE n.id IS UNIQUE;

// Framework outputs (BMC, Five Whys, Porter's, etc.)
CREATE CONSTRAINT framework_output_id IF NOT EXISTS FOR (n:FrameworkOutput) REQUIRE n.id IS UNIQUE;

// Decisions made during journey
CREATE CONSTRAINT decision_id IF NOT EXISTS FOR (n:Decision) REQUIRE n.id IS UNIQUE;

// Decision options (selected and rejected)
CREATE CONSTRAINT decision_option_id IF NOT EXISTS FOR (n:DecisionOption) REQUIRE n.id IS UNIQUE;

// Evidence supporting decisions
CREATE CONSTRAINT evidence_id IF NOT EXISTS FOR (n:Evidence) REQUIRE n.id IS UNIQUE;

// Generated programs (EPM outputs)
CREATE CONSTRAINT program_id IF NOT EXISTS FOR (n:Program) REQUIRE n.id IS UNIQUE;

// Eligibility criteria for incentives
CREATE CONSTRAINT eligibility_criterion_id IF NOT EXISTS FOR (n:EligibilityCriterion) REQUIRE n.id IS UNIQUE;

// =====================================
// INDEXES FOR EFFICIENT UPSERTS
// =====================================

// External IDs for location data from GeoNames, etc.
CREATE INDEX location_extId IF NOT EXISTS FOR (n:Location) ON (n.extId);

// External IDs for organization data
CREATE INDEX organization_extId IF NOT EXISTS FOR (n:Organization) ON (n.extId);

// Source keys for incentive deduplication
CREATE INDEX incentive_sourceKey IF NOT EXISTS FOR (n:Incentive) ON (n.sourceKey);

// Source keys for regulation deduplication
CREATE INDEX regulation_sourceKey IF NOT EXISTS FOR (n:Regulation) ON (n.sourceKey);

// Journey type for pattern matching
CREATE INDEX journey_type IF NOT EXISTS FOR (n:JourneySession) ON (n.journeyType);

// Framework type for analysis queries
CREATE INDEX framework_type IF NOT EXISTS FOR (n:FrameworkOutput) ON (n.framework);

// =====================================
// META SINGLETON
// =====================================

// Meta node to track schema version and migration state
MERGE (m:Meta {id: 'meta'})
SET m.graphSchemaVersion = '1.0',
    m.createdAt = datetime(),
    m.lastUpdated = datetime();
