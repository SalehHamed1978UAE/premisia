import { db } from "./db";
import { ontologyEntities, ontologyRelationships, ontologyValidationRules, ontologyCompletenessChecks, ontologyCascadeImpacts, ontologyDomainTerms, ontologyFrameworkMappings, } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
export class OntologyService {
    async getEntityDefinition(entityName) {
        const [entity] = await db
            .select()
            .from(ontologyEntities)
            .where(eq(ontologyEntities.entityName, entityName));
        return entity;
    }
    async getAllEntities() {
        return await db.select().from(ontologyEntities);
    }
    async getEntityRelationships(entityName, direction = "both") {
        if (direction === "from") {
            return await db
                .select()
                .from(ontologyRelationships)
                .where(eq(ontologyRelationships.fromEntity, entityName));
        }
        else if (direction === "to") {
            return await db
                .select()
                .from(ontologyRelationships)
                .where(eq(ontologyRelationships.toEntity, entityName));
        }
        else {
            return await db
                .select()
                .from(ontologyRelationships)
                .where(or(eq(ontologyRelationships.fromEntity, entityName), eq(ontologyRelationships.toEntity, entityName)));
        }
    }
    async getValidationRules(params) {
        let query = db.select().from(ontologyValidationRules);
        const conditions = [];
        if (params?.entity) {
            conditions.push(eq(ontologyValidationRules.entity, params.entity));
        }
        if (params?.category) {
            conditions.push(eq(ontologyValidationRules.category, params.category));
        }
        if (params?.severity) {
            conditions.push(eq(ontologyValidationRules.severity, params.severity));
        }
        if (params?.enabled !== undefined) {
            conditions.push(eq(ontologyValidationRules.enabled, params.enabled));
        }
        if (conditions.length > 0) {
            return await query.where(and(...conditions));
        }
        return await query;
    }
    async getCompletenessChecks(params) {
        let query = db.select().from(ontologyCompletenessChecks);
        const conditions = [];
        if (params?.entity) {
            conditions.push(eq(ontologyCompletenessChecks.entity, params.entity));
        }
        if (params?.checkType) {
            conditions.push(eq(ontologyCompletenessChecks.checkType, params.checkType));
        }
        if (params?.importance) {
            conditions.push(eq(ontologyCompletenessChecks.importance, params.importance));
        }
        if (params?.enabled !== undefined) {
            conditions.push(eq(ontologyCompletenessChecks.enabled, params.enabled));
        }
        if (conditions.length > 0) {
            return await query.where(and(...conditions));
        }
        return await query;
    }
    async getCascadeImpacts(trigger) {
        if (trigger) {
            return await db
                .select()
                .from(ontologyCascadeImpacts)
                .where(eq(ontologyCascadeImpacts.trigger, trigger));
        }
        return await db.select().from(ontologyCascadeImpacts);
    }
    async getDomainTerm(term) {
        const [domainTerm] = await db
            .select()
            .from(ontologyDomainTerms)
            .where(eq(ontologyDomainTerms.term, term));
        return domainTerm;
    }
    async getAllDomainTerms() {
        return await db.select().from(ontologyDomainTerms);
    }
    async getFrameworkMappings(params) {
        let query = db.select().from(ontologyFrameworkMappings);
        const conditions = [];
        if (params?.framework) {
            conditions.push(eq(ontologyFrameworkMappings.framework, params.framework));
        }
        if (params?.epmEntity) {
            conditions.push(eq(ontologyFrameworkMappings.epmEntity, params.epmEntity));
        }
        if (conditions.length > 0) {
            return await query.where(and(...conditions));
        }
        return await query;
    }
    async validateEntityData(entityName, data) {
        const rules = await this.getValidationRules({
            entity: entityName,
            enabled: true,
        });
        const results = {
            isValid: true,
            errors: [],
            warnings: [],
        };
        for (const rule of rules) {
            const ruleData = rule.data;
            const isViolated = this.evaluateValidationRule(rule.ruleId, ruleData, data);
            if (isViolated) {
                const issue = {
                    rule: rule.ruleId,
                    message: this.interpolateMessage(ruleData.errorMessage, data),
                    autoFix: ruleData.autoFix,
                };
                if (rule.severity === "error") {
                    results.errors.push(issue);
                    results.isValid = false;
                }
                else {
                    results.warnings.push(issue);
                }
            }
        }
        return results;
    }
    evaluateValidationRule(ruleId, ruleData, data) {
        // Basic validation checks
        // Date consistency rules
        if (ruleId === 'program-date-consistency' || ruleId === 'task-date-consistency') {
            return data.startDate && data.endDate && new Date(data.startDate) >= new Date(data.endDate);
        }
        if (ruleId === 'workstream-within-program-timeline') {
            // Would need program data to validate - skip for now
            return false;
        }
        if (ruleId === 'task-within-program-timeline') {
            // Would need program data to validate - skip for now
            return false;
        }
        // Relationship rules (require database queries)
        if (ruleData.category === 'relationship') {
            // These require checking related entities - not implemented in basic validator
            return false;
        }
        // Budget rules (require aggregation)
        if (ruleData.category === 'budget') {
            // These require aggregating funding/expenses - not implemented in basic validator
            return false;
        }
        // State rules (require conditional logic)
        if (ruleData.category === 'state') {
            // These require checking state and related data - not implemented in basic validator
            return false;
        }
        // Default: rule not violated (conservative approach)
        return false;
    }
    interpolateMessage(template, data) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? String(data[key]) : match;
        });
    }
    async checkCompleteness(entityName, data) {
        const checks = await this.getCompletenessChecks({
            entity: entityName,
            enabled: true,
        });
        const results = {
            score: 0,
            maxScore: 0,
            critical: { passed: 0, total: 0 },
            important: { passed: 0, total: 0 },
            niceToHave: { passed: 0, total: 0 },
            missingFields: [],
        };
        for (const check of checks) {
            const checkData = check.data;
            const fieldValue = data[checkData.field];
            const isPassed = fieldValue !== undefined && fieldValue !== null && fieldValue !== "";
            const scoreValue = check.importance === "critical" ? 3 : check.importance === "important" ? 2 : 1;
            results.maxScore += scoreValue;
            if (isPassed) {
                results.score += scoreValue;
                if (check.importance === "critical")
                    results.critical.passed++;
                else if (check.importance === "important")
                    results.important.passed++;
                else
                    results.niceToHave.passed++;
            }
            else {
                results.missingFields.push({
                    field: checkData.field,
                    importance: check.importance,
                    description: checkData.description,
                });
            }
            if (check.importance === "critical")
                results.critical.total++;
            else if (check.importance === "important")
                results.important.total++;
            else
                results.niceToHave.total++;
        }
        return results;
    }
    async getFullEntityContext(entityName) {
        const [definition, relationships, validationRules, completenessChecks, frameworkMappings] = await Promise.all([
            this.getEntityDefinition(entityName),
            this.getEntityRelationships(entityName),
            this.getValidationRules({ entity: entityName }),
            this.getCompletenessChecks({ entity: entityName }),
            this.getFrameworkMappings({ epmEntity: entityName }),
        ]);
        return {
            definition,
            relationships,
            validationRules,
            completenessChecks,
            frameworkMappings,
        };
    }
}
export const ontologyService = new OntologyService();
//# sourceMappingURL=ontology-service.js.map