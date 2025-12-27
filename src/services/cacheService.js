const memcached = require('memcached');

class CacheService {
  constructor() {
    this.client = new memcached(`${process.env.ELASTICACHE_ENDPOINT}:${process.env.ELASTICACHE_PORT}`, {
      retries: 10,
      retry: 10000,
      remove: true,
      failOverServers: [`${process.env.ELASTICACHE_ENDPOINT}:${process.env.ELASTICACHE_PORT}`]
    });
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, data) => {
        if (err) {
          console.error('Cache get error:', err);
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  async set(key, value, lifetime = 3600) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, lifetime, (err) => {
        if (err) {
          console.error('Cache set error:', err);
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  async delete(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err) => {
        if (err) {
          console.error('Cache delete error:', err);
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  async flush() {
    return new Promise((resolve, reject) => {
      this.client.flush((err) => {
        if (err) {
          console.error('Cache flush error:', err);
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  // 缓存用户会话
  async cacheUserSession(username, token, lifetime = 3600) {
    const key = `user:${username}`;
    return await this.set(key, token, lifetime);
  }

  // 获取用户会话
  async getUserSession(username) {
    const key = `user:${username}`;
    return await this.get(key);
  }

  // 删除用户会话
  async deleteUserSession(username) {
    const key = `user:${username}`;
    return await this.delete(key);
  }

  // 缓存查询结果
  async cacheQueryResult(queryKey, result, lifetime = 1800) {
    const key = `query:${queryKey}`;
    return await this.set(key, JSON.stringify(result), lifetime);
  }

  // 获取缓存的查询结果
  async getCachedQueryResult(queryKey) {
    const key = `query:${queryKey}`;
    const result = await this.get(key);
    return result ? JSON.parse(result) : null;
  }

  // 缓存媒体文件元数据
  async cacheMediaMetadata(mediaId, metadata, lifetime = 3600) {
    const key = `media:${mediaId}`;
    return await this.set(key, JSON.stringify(metadata), lifetime);
  }

  // 获取缓存的媒体文件元数据
  async getCachedMediaMetadata(mediaId) {
    const key = `media:${mediaId}`;
    const result = await this.get(key);
    return result ? JSON.parse(result) : null;
  }

  // 关闭连接
  close() {
    this.client.end();
  }
}

const cacheService = new CacheService();

async function initializeCache() {
  try {
    // 测试连接
    await cacheService.set('test', 'connection', 10);
    console.log('Cache service connected successfully');
  } catch (error) {
    console.error('Cache service initialization failed:', error);
  }
}

module.exports = { cacheService, initializeCache };
