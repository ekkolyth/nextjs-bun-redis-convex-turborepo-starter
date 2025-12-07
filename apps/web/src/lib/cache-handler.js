const Redis = require("ioredis");

let redisClient = null;

// Configuration options
const CONFIG = {
  // Timeout for Redis operations in milliseconds
  commandTimeout: process.env.REDIS_COMMAND_TIMEOUT_MS 
    ? Number.parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS) || 500 
    : 500,
  // Enable in-memory caching layer
  inMemoryCaching: process.env.REDIS_IN_MEMORY_CACHING !== "false",
  // Time to cache in memory (milliseconds)
  inMemoryCachingTime: Number.parseInt(process.env.REDIS_IN_MEMORY_CACHING_TIME) || 10000,
  // Default stale age in seconds (14 days)
  defaultStaleAge: Number.parseInt(process.env.REDIS_DEFAULT_STALE_AGE) || 1209600,
};

// In-memory cache for get operations (request deduplication)
const inMemoryCache = new Map();

function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL || "redis://localhost:6379";
    
    // Parse Redis URL for ioredis
    const url = new URL(redisUrl);
    const options = {
      host: url.hostname,
      port: url.port ? Number.parseInt(url.port) : 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      db: url.pathname ? Number.parseInt(url.pathname.slice(1)) : 0,
      connectTimeout: 5000,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableOfflineQueue: true,
      enableAutoPipelining: true,
    };

    // Handle TLS
    if (redisUrl.startsWith("rediss://") || redisUrl.startsWith("redis+tls://")) {
      options.tls = {
        rejectUnauthorized: false,
      };
    }

    redisClient = new Redis(redisUrl, options);
    
    // Handle connection errors
    redisClient.on("error", (error) => {
      console.error("Redis connection error:", error);
    });
  }
  return redisClient;
}

function getCacheKey(key, pathname, kind) {
  // Include kind in cache key for proper separation (APP_ROUTE, APP_PAGE, FETCH)
  const kindPrefix = kind ? `${kind}:` : "";
  return `nextjs:cache:${kindPrefix}${pathname}:${key}`;
}

function getTagKey(tag) {
  return `nextjs:tag:${tag}`;
}

// Helper to create a timeout promise
function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Redis operation timeout")), timeoutMs)
    ),
  ]);
}

class RedisCacheHandler {
  constructor(ctx) {
    this.client = getRedisClient();
    this.pathname = ctx.pathname || "";
    this.kind = ctx.kind || null;
  }

  async get(key) {
    const cacheKey = getCacheKey(key, this.pathname, this.kind);
    
    // Check in-memory cache first
    if (CONFIG.inMemoryCaching) {
      const cached = inMemoryCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
      }
      // Remove expired entry
      if (cached) {
        inMemoryCache.delete(cacheKey);
      }
    }

    try {
      // Use timeout to avoid blocking
      const cached = await withTimeout(
        this.client.get(cacheKey),
        CONFIG.commandTimeout
      );
      
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      
      // Check if stale based on staleAge
      // If lastModified + staleAge is in the past, consider it stale
      if (parsed.staleAge && parsed.lastModified) {
        const staleTime = parsed.lastModified + (parsed.staleAge * 1000);
        if (Date.now() > staleTime) {
          await this.client.del(cacheKey).catch(() => {});
          return null;
        }
      }

      const result = {
        value: parsed.value,
        lastModified: parsed.lastModified || Date.now(),
      };

      // Store in in-memory cache
      if (CONFIG.inMemoryCaching) {
        inMemoryCache.set(cacheKey, {
          value: result,
          expiresAt: Date.now() + CONFIG.inMemoryCachingTime,
        });
      }

      return result;
    } catch (error) {
      // On timeout or error, return null to avoid blocking
      if (error.message === "Redis operation timeout") {
        console.warn(`Redis get timeout for key: ${cacheKey}`);
      } else {
        console.error("Redis cache get error:", error);
      }
      return null;
    }
  }

  async set(key, data, ctx) {
    try {
      const cacheKey = getCacheKey(key, this.pathname, this.kind);
      
      // Calculate expiration
      // If revalidate is a number, use it as stale age in seconds
      // Otherwise, use default stale age
      const staleAge = ctx.revalidate && typeof ctx.revalidate === "number" && ctx.revalidate > 0
        ? ctx.revalidate
        : CONFIG.defaultStaleAge;
      
      // Estimate expire age (TTL) - typically 2x stale age in production
      const expireAge = process.env.NODE_ENV === "production" 
        ? staleAge * 2 
        : Math.ceil(staleAge * 1.2);

      const cacheData = {
        value: data,
        lastModified: Date.now(),
        staleAge,
        tags: ctx.tags || [],
      };

      // Set cache value with expiration
      await this.client.set(cacheKey, JSON.stringify(cacheData));
      await this.client.expire(cacheKey, expireAge);

      // Update in-memory cache
      if (CONFIG.inMemoryCaching) {
        inMemoryCache.set(cacheKey, {
          value: {
            value: data,
            lastModified: Date.now(),
          },
          expiresAt: Date.now() + CONFIG.inMemoryCachingTime,
        });
      }

      // Track keys by tag using Redis sets for better performance
      if (ctx.tags && ctx.tags.length > 0) {
        for (const tag of ctx.tags) {
          const tagKey = getTagKey(tag);
          try {
            // Use Redis set to track keys for this tag
            await this.client.sadd(tagKey, cacheKey);
            // Set expiration on tag key as well
            await this.client.expire(tagKey, expireAge);
          } catch (error) {
            // Fallback to JSON array if SET operations aren't available
            try {
              const existingKeys = await this.client.get(tagKey);
              const keyList = existingKeys ? JSON.parse(existingKeys) : [];
              if (!keyList.includes(cacheKey)) {
                keyList.push(cacheKey);
                await this.client.set(tagKey, JSON.stringify(keyList));
                await this.client.expire(tagKey, expireAge);
              }
            } catch (fallbackError) {
              console.error("Redis tag tracking error:", fallbackError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Redis cache set error:", error);
    }
  }

  async revalidateTag(tag) {
    try {
      const tagKey = getTagKey(tag);
      let keys = [];
      
      try {
        // Try to get keys from Redis set
        keys = await this.client.smembers(tagKey);
      } catch (error) {
        // Fallback to JSON array if SET operations aren't available
        try {
          const keysJson = await this.client.get(tagKey);
          if (keysJson) {
            keys = JSON.parse(keysJson);
          }
        } catch (fallbackError) {
          console.error("Redis revalidateTag error:", fallbackError);
          return;
        }
      }
      
      if (keys && keys.length > 0) {
        // Delete all cached keys
        const deletePromises = keys.map(key => this.client.del(key));
        await Promise.all(deletePromises);
        
        // Clear from in-memory cache
        if (CONFIG.inMemoryCaching) {
          keys.forEach(key => inMemoryCache.delete(key));
        }
      }
      
      // Delete the tag set/key
      await this.client.del(tagKey);
    } catch (error) {
      console.error("Redis cache revalidateTag error:", error);
    }
  }
}

module.exports = RedisCacheHandler;

