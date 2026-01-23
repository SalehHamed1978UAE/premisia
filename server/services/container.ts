/**
 * Service Container - Dependency Injection for modular services
 * 
 * Provides lazy initialization and singleton instances for services.
 */

import { ServiceKeys } from '../types/interfaces';
import { createOpenAIProvider } from '../../src/lib/intelligent-planning/llm-provider';

/**
 * Create LLM provider for WBS Builder and intelligent planning
 * Returns null if no API key is available
 */
function createLLMProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Container] No OPENAI_API_KEY - WBS Builder will use fallback mode');
    return null;
  }
  return createOpenAIProvider({ apiKey, model: 'gpt-5' });
}

export class ServiceContainer {
  private services: Map<string, unknown> = new Map();
  private factories: Map<string, () => unknown> = new Map();

  register<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
  }

  registerInstance<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  resolve<T>(name: string): T {
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service '${name}' not registered`);
    }

    const instance = factory();
    this.services.set(name, instance);
    return instance as T;
  }

  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  clear(): void {
    this.services.clear();
  }
}

export const container = new ServiceContainer();

/**
 * Register all services with the container
 * Called during application startup
 */
export function registerServices(): void {
  // Export services
  container.register(ServiceKeys.EXPORT_ORCHESTRATOR, () => {
    const { generateFullPassExport } = require('./export');
    return { generateFullPassExport };
  });

  container.register(ServiceKeys.MARKDOWN_EXPORTER, () => {
    const { MarkdownExporter } = require('./export/markdown-exporter');
    return new MarkdownExporter();
  });

  container.register(ServiceKeys.HTML_EXPORTER, () => {
    const { HtmlExporter } = require('./export/html-exporter');
    return new HtmlExporter();
  });

  container.register(ServiceKeys.PDF_EXPORTER, () => {
    const { PdfExporter } = require('./export/pdf-exporter');
    return new PdfExporter();
  });

  container.register(ServiceKeys.DOCX_EXPORTER, () => {
    const { DocxExporter } = require('./export/docx-exporter');
    return new DocxExporter();
  });

  container.register(ServiceKeys.CSV_EXPORTER, () => {
    const { CsvExporter } = require('./export/csv-exporter');
    return new CsvExporter();
  });

  // EPM services - pass proper LLM provider for WBS Builder
  container.register(ServiceKeys.EPM_SYNTHESIZER, () => {
    const { EPMSynthesizer } = require('../intelligence/epm-synthesizer');
    const llm = createLLMProvider();
    return new EPMSynthesizer(llm);
  });

  // Note: ContextBuilder uses static methods (ContextBuilder.fromJourneyInsights)
  // so we register the class itself, not an instance
  container.register(ServiceKeys.CONTEXT_BUILDER, () => {
    const { ContextBuilder } = require('../intelligence/epm/context-builder');
    return ContextBuilder; // Static class - use as ContextBuilder.fromJourneyInsights(...)
  });

  container.register(ServiceKeys.WORKSTREAM_GENERATOR, () => {
    const { WorkstreamGenerator } = require('../intelligence/epm/workstream-generator');
    const llm = createLLMProvider();
    return new WorkstreamGenerator(llm);
  });

  container.register(ServiceKeys.TIMELINE_CALCULATOR, () => {
    const { TimelineCalculator } = require('../intelligence/epm/timeline-calculator');
    return new TimelineCalculator();
  });

  container.register(ServiceKeys.RESOURCE_ALLOCATOR, () => {
    const { ResourceAllocator } = require('../intelligence/epm/resource-allocator');
    return new ResourceAllocator();
  });

  container.register(ServiceKeys.EPM_VALIDATOR, () => {
    const { EPMValidator } = require('../intelligence/epm/validator');
    return new EPMValidator();
  });

  // SSE Progress Manager
  container.register(ServiceKeys.SSE_PROGRESS_MANAGER, () => {
    const { SSEProgressManager } = require('./sse-progress-manager');
    return new SSEProgressManager();
  });

  // Repositories
  container.register(ServiceKeys.EPM_REPOSITORY, () => {
    const { EPMRepository } = require('../repositories');
    return new EPMRepository();
  });

  container.register(ServiceKeys.JOURNEY_REPOSITORY, () => {
    const { JourneyRepository } = require('../repositories');
    return new JourneyRepository();
  });

  container.register(ServiceKeys.STRATEGY_REPOSITORY, () => {
    const { StrategyRepository } = require('../repositories');
    return new StrategyRepository();
  });

  console.log('[Container] ✓ Services and repositories registered');
}

/**
 * Helper to get typed services from the container
 */
export function getService<T>(key: string): T {
  return container.resolve<T>(key);
}
