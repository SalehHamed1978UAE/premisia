import { db } from "./db";
import { 
  ontologyEntities, 
  ontologyRelationships,
  ontologyValidationRules,
  ontologyCompletenessChecks,
  ontologyCascadeImpacts,
  ontologyDomainTerms,
  ontologyFrameworkMappings
} from "@shared/schema";
import EPM_ONTOLOGY, {
  EPM_RELATIONSHIP_GRAPH,
  VALIDATION_RULES,
  COMPLETENESS_CRITERIA,
  CASCADE_IMPACT_MODEL,
  DOMAIN_VOCABULARY,
  FRAMEWORK_MAPPINGS
} from "@shared/ontology";

async function seedOntology() {
  console.log("Starting ontology seeding...");

  try {
    console.log("Seeding entity definitions...");
    for (const [entityName, definition] of Object.entries(EPM_ONTOLOGY)) {
      await db.insert(ontologyEntities).values({
        entityName,
        definition: definition.definition,
        purpose: definition.purpose,
        data: definition as any,
      }).onConflictDoUpdate({
        target: ontologyEntities.entityName,
        set: {
          definition: definition.definition,
          purpose: definition.purpose,
          data: definition as any,
          updatedAt: new Date(),
        }
      });
    }
    console.log(`✓ Seeded ${Object.keys(EPM_ONTOLOGY).length} entity definitions`);

    console.log("Seeding relationships...");
    for (const relationship of EPM_RELATIONSHIP_GRAPH) {
      await db.insert(ontologyRelationships).values({
        fromEntity: relationship.from,
        toEntity: relationship.to,
        relationshipType: relationship.type,
        cardinality: relationship.cardinality,
        required: relationship.required,
        data: relationship as any,
      }).onConflictDoUpdate({
        target: [ontologyRelationships.fromEntity, ontologyRelationships.toEntity, ontologyRelationships.relationshipType],
        set: {
          cardinality: relationship.cardinality,
          required: relationship.required,
          data: relationship as any,
          updatedAt: new Date(),
        }
      });
    }
    console.log(`✓ Seeded ${EPM_RELATIONSHIP_GRAPH.length} relationships`);

    console.log("Seeding validation rules...");
    for (const rule of VALIDATION_RULES) {
      await db.insert(ontologyValidationRules).values({
        ruleId: rule.id,
        entity: rule.entity,
        category: rule.category,
        severity: rule.severity,
        rule: rule.rule,
        validation: rule.validation,
        data: rule as any,
        enabled: true,
      }).onConflictDoUpdate({
        target: ontologyValidationRules.ruleId,
        set: {
          entity: rule.entity,
          category: rule.category,
          severity: rule.severity,
          rule: rule.rule,
          validation: rule.validation,
          data: rule as any,
          updatedAt: new Date(),
        }
      });
    }
    console.log(`✓ Seeded ${VALIDATION_RULES.length} validation rules`);

    console.log("Seeding completeness checks...");
    for (const check of COMPLETENESS_CRITERIA) {
      await db.insert(ontologyCompletenessChecks).values({
        checkId: check.id,
        entity: check.entity,
        checkType: check.checkType,
        importance: check.importance,
        description: check.description,
        validation: check.validation,
        data: check as any,
        enabled: true,
      }).onConflictDoUpdate({
        target: ontologyCompletenessChecks.checkId,
        set: {
          entity: check.entity,
          checkType: check.checkType,
          importance: check.importance,
          description: check.description,
          validation: check.validation,
          data: check as any,
          updatedAt: new Date(),
        }
      });
    }
    console.log(`✓ Seeded ${COMPLETENESS_CRITERIA.length} completeness checks`);

    console.log("Seeding cascade impacts...");
    for (const impact of CASCADE_IMPACT_MODEL) {
      await db.insert(ontologyCascadeImpacts).values({
        trigger: impact.trigger,
        automationPotential: impact.automationPotential,
        impactDescription: impact.impactDescription,
        data: impact as any,
      }).onConflictDoUpdate({
        target: ontologyCascadeImpacts.trigger,
        set: {
          automationPotential: impact.automationPotential,
          impactDescription: impact.impactDescription,
          data: impact as any,
          updatedAt: new Date(),
        }
      });
    }
    console.log(`✓ Seeded ${CASCADE_IMPACT_MODEL.length} cascade impacts`);

    console.log("Seeding domain terms...");
    for (const term of DOMAIN_VOCABULARY) {
      await db.insert(ontologyDomainTerms).values({
        term: term.term,
        definition: term.definition,
        context: term.context,
        data: term as any,
      }).onConflictDoUpdate({
        target: ontologyDomainTerms.term,
        set: {
          definition: term.definition,
          context: term.context,
          data: term as any,
          updatedAt: new Date(),
        }
      });
    }
    console.log(`✓ Seeded ${DOMAIN_VOCABULARY.length} domain terms`);

    console.log("Seeding framework mappings...");
    for (const mapping of FRAMEWORK_MAPPINGS) {
      await db.insert(ontologyFrameworkMappings).values({
        framework: mapping.framework,
        concept: mapping.concept,
        epmEntity: mapping.epmEntity,
        mapping: mapping.mapping,
        data: mapping as any,
      }).onConflictDoUpdate({
        target: [ontologyFrameworkMappings.framework, ontologyFrameworkMappings.concept, ontologyFrameworkMappings.epmEntity],
        set: {
          mapping: mapping.mapping,
          data: mapping as any,
          updatedAt: new Date(),
        }
      });
    }
    console.log(`✓ Seeded ${FRAMEWORK_MAPPINGS.length} framework mappings`);

    console.log("✓ Ontology seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding ontology:", error);
    throw error;
  }
}

seedOntology()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
