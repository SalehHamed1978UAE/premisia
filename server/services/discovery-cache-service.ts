import crypto from 'crypto';

interface CacheEntry {
  result: any;
  timestamp: number;
  userId: string;
}

class DiscoveryCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  generateKey(userId: string, context: any): string {
    const normalized = JSON.stringify({
      description: context.offeringDescription?.toLowerCase().trim(),
      offeringType: context.offeringType,
      stage: context.stage,
      gtmConstraint: context.gtmConstraint,
      salesMotion: context.salesMotion,
      existingHypothesis: context.existingHypothesis?.toLowerCase().trim() || null,
    });
    return crypto.createHash('sha256')
      .update(`${userId}||${normalized}`)
      .digest('hex');
  }

  get(userId: string, context: any): any | null {
    const key = this.generateKey(userId, context);
    const entry = this.cache.get(key);

    if (!entry) return null;
    
    // Security check - ensure userId matches
    if (entry.userId !== userId) {
      console.warn(`[DiscoveryCache] Security: userId mismatch for key ${key.slice(0, 8)}...`);
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      console.log(`[DiscoveryCache] EXPIRED for user ${userId.slice(0, 8)}...`);
      return null;
    }

    console.log(`[DiscoveryCache] HIT for user ${userId.slice(0, 8)}... (age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s)`);
    return entry.result;
  }

  set(userId: string, context: any, result: any): void {
    const key = this.generateKey(userId, context);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      userId,
    });
    console.log(`[DiscoveryCache] STORED for user ${userId.slice(0, 8)}... (key: ${key.slice(0, 8)}...)`);
  }

  clear(userId?: string): void {
    if (userId) {
      // Clear only entries for this user
      const keysToDelete: string[] = [];
      this.cache.forEach((entry, key) => {
        if (entry.userId === userId) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
      console.log(`[DiscoveryCache] Cleared entries for user ${userId.slice(0, 8)}...`);
    } else {
      this.cache.clear();
      console.log('[DiscoveryCache] Cleared all entries');
    }
  }

  size(): number {
    return this.cache.size;
  }
}

export const discoveryCacheService = new DiscoveryCacheService();
