const cache = new Map(); exports.get = key => cache.get(key); exports.set = (key, value, ttl = 300000) => { cache.set(key, value); setTimeout(() => cache.delete(key), ttl).unref?.(); return value; };
