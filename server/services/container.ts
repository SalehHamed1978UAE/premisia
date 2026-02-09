/**
 * Service Container - Dependency Injection for modular services
 * 
 * Provides lazy initialization and singleton instances for services.
 * Uses eager imports for ES modules compatibility.
 */

import { ServiceKeys } from '../types/interfaces';
import { createOpenAIProvider } from '../../src/lib/intelligent-planning/llm-provider';

import { generateFullPassExport } from './export';
import { MarkdownExporter } from './export/markdown-exporter';
import { HtmlExporter } from './export/html-exporter';
import { PdfExporter } from './export/pdf-exporter';
import { DocxExporter } from './export/docx-exporter';
import { CsvExporter } from './export/csv-exporter';
import { EPMSynthesizer } from '../intelligence/epm-synthesizer';
import { ContextBuilder } from '../intelligence/epm/context-builder';
import { WorkstreamGenerator } from '../intelligence/epm/workstream-generator';
import { TimelineCalculator } from '../intelligence/epm/timeline-calculator';
import { ResourceAllocator } from '../intelligence/epm/resource-allocator';
import { EPMValidator } from '../intelligence/epm/validator';
import { sseProgressManager } from './sse-progress-manager';
import { EPMRepository, JourneyRepository, StrategyRepository } from '../repositories';

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
  container.register(ServiceKeys.EXPORT_ORCHESTRATOR, () => {
    return { generateFullPassExport };
  });

  container.register(ServiceKeys.MARKDOWN_EXPORTER, () => {
    return new MarkdownExporter();
  });

  container.register(ServiceKeys.HTML_EXPORTER, () => {
    return new HtmlExporter();
  });

  container.register(ServiceKeys.PDF_EXPORTER, () => {
    return new PdfExporter();
  });

  container.register(ServiceKeys.DOCX_EXPORTER, () => {
    return new DocxExporter();
  });

  container.register(ServiceKeys.CSV_EXPORTER, () => {
    return new CsvExporter();
  });

  container.register(ServiceKeys.EPM_SYNTHESIZER, () => {
    const llm = createLLMProvider();
    return new EPMSynthesizer(llm);
  });

  container.register(ServiceKeys.CONTEXT_BUILDER, () => {
    return ContextBuilder;
  });

  container.register(ServiceKeys.WORKSTREAM_GENERATOR, () => {
    const llm = createLLMProvider();
    return new WorkstreamGenerator(llm);
  });

  container.register(ServiceKeys.TIMELINE_CALCULATOR, () => {
    return new TimelineCalculator();
  });

  container.register(ServiceKeys.RESOURCE_ALLOCATOR, () => {
    return new ResourceAllocator();
  });

  container.register(ServiceKeys.EPM_VALIDATOR, () => {
    return new EPMValidator();
  });

  container.register(ServiceKeys.SSE_PROGRESS_MANAGER, () => {
    return sseProgressManager;
  });

  container.register(ServiceKeys.EPM_REPOSITORY, () => {
    return new EPMRepository();
  });

  container.register(ServiceKeys.JOURNEY_REPOSITORY, () => {
    return new JourneyRepository();
  });

  container.register(ServiceKeys.STRATEGY_REPOSITORY, () => {
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
