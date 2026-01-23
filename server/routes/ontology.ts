import { Router, Request, Response } from 'express';
import { ontologyService } from '../ontology-service';

const router = Router();

router.get("/entities", async (req: Request, res: Response) => {
  try {
    const entities = await ontologyService.getAllEntities();
    res.json(entities);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch entity definitions" });
  }
});

router.get("/entities/:entityName", async (req: Request, res: Response) => {
  try {
    const entity = await ontologyService.getEntityDefinition(req.params.entityName as any);
    if (!entity) {
      return res.status(404).json({ message: "Entity not found" });
    }
    res.json(entity);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch entity definition" });
  }
});

router.get("/entities/:entityName/context", async (req: Request, res: Response) => {
  try {
    const context = await ontologyService.getFullEntityContext(req.params.entityName as any);
    res.json(context);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch entity context" });
  }
});

router.get("/relationships", async (req: Request, res: Response) => {
  try {
    const { entity, direction } = req.query;
    if (entity) {
      const relationships = await ontologyService.getEntityRelationships(
        entity as any,
        (direction as any) || "both"
      );
      res.json(relationships);
    } else {
      res.status(400).json({ message: "Entity parameter required" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch relationships" });
  }
});

router.get("/validation-rules", async (req: Request, res: Response) => {
  try {
    const { entity, category, severity, enabled } = req.query;
    const rules = await ontologyService.getValidationRules({
      entity: entity as any,
      category: category as string,
      severity: severity as any,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
    });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch validation rules" });
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { entityName, data } = req.body;
    if (!entityName || !data) {
      return res.status(400).json({ message: "entityName and data required" });
    }
    const result = await ontologyService.validateEntityData(entityName, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to validate entity data" });
  }
});

router.get("/completeness-checks", async (req: Request, res: Response) => {
  try {
    const { entity, checkType, importance, enabled } = req.query;
    const checks = await ontologyService.getCompletenessChecks({
      entity: entity as any,
      checkType: checkType as string,
      importance: importance as any,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
    });
    res.json(checks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch completeness checks" });
  }
});

router.post("/check-completeness", async (req: Request, res: Response) => {
  try {
    const { entityName, data } = req.body;
    if (!entityName || !data) {
      return res.status(400).json({ message: "entityName and data required" });
    }
    const result = await ontologyService.checkCompleteness(entityName, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to check completeness" });
  }
});

router.get("/cascade-impacts", async (req: Request, res: Response) => {
  try {
    const { trigger } = req.query;
    const impacts = await ontologyService.getCascadeImpacts(trigger as string);
    res.json(impacts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch cascade impacts" });
  }
});

router.get("/domain-terms", async (req: Request, res: Response) => {
  try {
    const { term } = req.query;
    if (term) {
      const domainTerm = await ontologyService.getDomainTerm(term as string);
      if (!domainTerm) {
        return res.status(404).json({ message: "Term not found" });
      }
      res.json(domainTerm);
    } else {
      const terms = await ontologyService.getAllDomainTerms();
      res.json(terms);
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch domain terms" });
  }
});

router.get("/framework-mappings", async (req: Request, res: Response) => {
  try {
    const { framework, epmEntity } = req.query;
    const mappings = await ontologyService.getFrameworkMappings({
      framework: framework as string,
      epmEntity: epmEntity as any,
    });
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch framework mappings" });
  }
});

export default router;
