/**
 * @module planning/utils/cache
 * Caching layer for expensive LLM operations
 */

import crypto from 'crypto';
import { LLMProvider } from './interfaces';

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

export interface CacheConfig {
  maxSize: number;
  ttlMs: number;
  enablePersistence?: boolean;
  persistencePath?: string;
}

/**
 * In-memory cache implementation
 */
export class InMemoryCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, evictions: 0 };
  
  constructor(private config: CacheConfig) {
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }
  
  /**
   * Get item from cache
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update hit count and stats
    entry.hits++;
    this.stats.hits++;
    
    return entry.value;
  }
  
  /**
   * Set item in cache
   */
  set(key: string, value: any, ttlMs?: number): void {
    const ttl = ttlMs || this.config.ttlMs;
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      hits: 0
    };
    
    // Check size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }
  
  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    let oldestTime = Date.now();
    let oldestKey = '';
    
    for (const [key, entry] of this.cache) {
      const lastAccess = entry.timestamp + (entry.hits * 1000);
      if (lastAccess < oldestTime) {
        oldestTime = lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cache cleanup: Removed ${cleaned} expired entries`);
      this.stats.size = this.cache.size;
    }
  }
}

/**
 * Cached LLM Provider wrapper
 */
export class CachedLLMProvider implements LLMProvider {
  private cache: InMemoryCache;
  
  constructor(
    private provider: LLMProvider,
    cacheConfig?: Partial<CacheConfig>
  ) {
    this.cache = new InMemoryCache({
      maxSize: 100,
      ttlMs: 3600000, // 1 hour default
      ...cacheConfig
    });
  }
  
  async generate(prompt: string): Promise<string> {
    const cacheKey = this.generateCacheKey('generate', prompt);
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('Cache hit for generate');
      return cached;
    }
    
    // Generate new response
    console.log('Cache miss for generate, calling LLM...');
    const result = await this.provider.generate(prompt);
    
    // Cache the result
    this.cache.set(cacheKey, result);
    
    return result;
  }
  
  async generateStructured<T>(config: {
    prompt: string;
    schema: any;
  }): Promise<T> {
    const cacheKey = this.generateCacheKey(
      'generateStructured',
      JSON.stringify(config)
    );
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('Cache hit for generateStructured');
      return cached as T;
    }
    
    // Generate new response
    console.log('Cache miss for generateStructured, calling LLM...');
    const result = await this.provider.generateStructured<T>(config);
    
    // Cache the result
    this.cache.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * Generate deterministic cache key
   */
  private generateCacheKey(method: string, input: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${method}:${input}`);
    return hash.digest('hex');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
