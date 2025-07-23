# JavaScript异步编程最佳实践

异步编程是JavaScript的核心特性之一，掌握异步编程的最佳实践对于编写高性能、可维护的JavaScript代码至关重要。

## 异步编程基础

### 什么是异步编程？

异步编程允许程序在等待某些操作完成时继续执行其他任务，而不会阻塞整个程序的执行。

### JavaScript中的异步模型

JavaScript使用**事件循环**（Event Loop）来处理异步操作：

1. **调用栈**（Call Stack）：同步代码执行
2. **任务队列**（Task Queue）：宏任务队列
3. **微任务队列**（Microtask Queue）：微任务队列

## 异步编程演进史

### 1. 回调函数（Callbacks）

最早的异步编程方式，但容易导致"回调地狱"。

```javascript
// 回调地狱示例
getData(function(a) {
    getMoreData(a, function(b) {
        getEvenMoreData(b, function(c) {
            // 嵌套越来越深...
        });
    });
});
```

#### 问题
- 代码难以阅读和维护
- 错误处理复杂
- 难以进行流程控制

### 2. Promise

ES6引入的Promise解决了回调地狱问题。

```javascript
// Promise链式调用
getData()
    .then(a => getMoreData(a))
    .then(b => getEvenMoreData(b))
    .then(c => console.log(c))
    .catch(error => console.error(error));
```

#### 优势
- 链式调用，代码更清晰
- 统一的错误处理
- 更好的组合性

### 3. async/await

ES2017引入的语法糖，让异步代码看起来像同步代码。

```javascript
// async/await示例
async function processData() {
    try {
        const a = await getData();
        const b = await getMoreData(a);
        const c = await getEvenMoreData(b);
        console.log(c);
    } catch (error) {
        console.error(error);
    }
}
```

## 最佳实践

### 1. 优先使用async/await

#### 推荐写法
```javascript
async function fetchUserData(userId) {
    try {
        const user = await fetch(`/api/users/${userId}`);
        const userData = await user.json();
        return userData;
    } catch (error) {
        console.error('Failed to fetch user data:', error);
        throw error;
    }
}
```

#### 避免的写法
```javascript
// 不推荐：混用Promise和async/await
async function badExample() {
    return fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            // 混乱的代码风格
            return data;
        });
}
```

### 2. 并行处理独立的异步操作

#### 使用Promise.all()
```javascript
// 并行执行多个独立的异步操作
async function fetchAllData() {
    try {
        const [users, posts, comments] = await Promise.all([
            fetch('/api/users').then(r => r.json()),
            fetch('/api/posts').then(r => r.json()),
            fetch('/api/comments').then(r => r.json())
        ]);
        
        return { users, posts, comments };
    } catch (error) {
        console.error('Failed to fetch data:', error);
        throw error;
    }
}
```

#### 使用Promise.allSettled()处理部分失败
```javascript
async function fetchDataWithFaultTolerance() {
    const results = await Promise.allSettled([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/posts').then(r => r.json()),
        fetch('/api/comments').then(r => r.json())
    ]);
    
    const successfulResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
        
    const errors = results
        .filter(result => result.status === 'rejected')
        .map(result => result.reason);
        
    return { data: successfulResults, errors };
}
```

### 3. 正确处理错误

#### 使用try-catch包装await
```javascript
async function robustFunction() {
    try {
        const result = await riskyOperation();
        return result;
    } catch (error) {
        // 记录错误
        console.error('Operation failed:', error);
        
        // 返回默认值或重新抛出
        return defaultValue;
        // 或者 throw new Error('Custom error message');
    }
}
```

#### 创建错误处理中间件
```javascript
function withErrorHandling(asyncFn) {
    return async function(...args) {
        try {
            return await asyncFn.apply(this, args);
        } catch (error) {
            console.error(`Error in ${asyncFn.name}:`, error);
            // 可以添加错误上报逻辑
            throw error;
        }
    };
}

const safeFunction = withErrorHandling(async function() {
    // 可能抛出错误的异步操作
});
```

### 4. 避免在循环中使用async/await

#### 问题代码
```javascript
// 不推荐：顺序执行，性能差
async function processItems(items) {
    const results = [];
    for (const item of items) {
        const result = await processItem(item); // 阻塞执行
        results.push(result);
    }
    return results;
}
```

#### 改进方案
```javascript
// 推荐：并行执行
async function processItems(items) {
    const promises = items.map(item => processItem(item));
    return Promise.all(promises);
}

// 或者需要控制并发数量时
async function processItemsConcurrent(items, concurrency = 3) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchPromises = batch.map(item => processItem(item));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }
    return results;
}
```

### 5. 使用适当的超时机制

```javascript
function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
        )
    ]);
}

async function fetchWithTimeout(url, timeoutMs = 5000) {
    try {
        const response = await withTimeout(fetch(url), timeoutMs);
        return await response.json();
    } catch (error) {
        if (error.message === 'Operation timeout') {
            console.error('Request timed out');
        }
        throw error;
    }
}
```

### 6. 实现重试机制

```javascript
async function withRetry(asyncFn, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await asyncFn();
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // 指数退避
            }
        }
    }
    
    throw lastError;
}

// 使用示例
const data = await withRetry(() => fetch('/api/data').then(r => r.json()));
```

## 高级模式

### 1. 异步迭代器

```javascript
async function* fetchPages(baseUrl) {
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const response = await fetch(`${baseUrl}?page=${page}`);
        const data = await response.json();
        
        yield data.items;
        
        hasMore = data.hasMore;
        page++;
    }
}

// 使用异步迭代器
async function processAllPages() {
    for await (const items of fetchPages('/api/items')) {
        console.log('Processing page with', items.length, 'items');
        // 处理当前页数据
    }
}
```

### 2. 队列和限流

```javascript
class AsyncQueue {
    constructor(concurrency = 1) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }
    
    async add(asyncFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                asyncFn,
                resolve,
                reject
            });
            this.process();
        });
    }
    
    async process() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }
        
        this.running++;
        const { asyncFn, resolve, reject } = this.queue.shift();
        
        try {
            const result = await asyncFn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }
}

// 使用示例
const queue = new AsyncQueue(3); // 最多并发3个请求

const results = await Promise.all([
    queue.add(() => fetch('/api/data1').then(r => r.json())),
    queue.add(() => fetch('/api/data2').then(r => r.json())),
    queue.add(() => fetch('/api/data3').then(r => r.json()))
]);
```

### 3. 缓存异步结果

```javascript
class AsyncCache {
    constructor(ttl = 60000) { // 默认1分钟过期
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    async get(key, asyncFn) {
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.value;
        }
        
        const value = await asyncFn();
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
        
        return value;
    }
    
    clear() {
        this.cache.clear();
    }
}

// 使用示例
const cache = new AsyncCache(30000); // 30秒缓存

async function getCachedUserData(userId) {
    return cache.get(`user:${userId}`, () => 
        fetch(`/api/users/${userId}`).then(r => r.json())
    );
}
```

## 性能优化

### 1. 预加载数据

```javascript
// 预加载关键数据
async function preloadCriticalData() {
    const criticalDataPromise = fetch('/api/critical-data').then(r => r.json());
    
    // 立即返回Promise，不等待完成
    return criticalDataPromise;
}

// 在应用启动时调用
const criticalDataPromise = preloadCriticalData();

// 需要使用时await
async function useCriticalData() {
    const data = await criticalDataPromise;
    // 使用预加载的数据
}
```

### 2. 懒加载

```javascript
class LazyLoader {
    constructor() {
        this.loadPromises = new Map();
    }
    
    async load(key, loader) {
        if (!this.loadPromises.has(key)) {
            this.loadPromises.set(key, loader());
        }
        return this.loadPromises.get(key);
    }
}

const lazyLoader = new LazyLoader();

// 使用示例
async function getExpensiveData() {
    return lazyLoader.load('expensive-data', () => 
        fetch('/api/expensive-operation').then(r => r.json())
    );
}
```

## 调试和测试

### 1. 异步代码调试

```javascript
// 添加调试信息
async function debugAsyncFunction(name, asyncFn) {
    console.time(name);
    try {
        const result = await asyncFn();
        console.timeEnd(name);
        return result;
    } catch (error) {
        console.timeEnd(name);
        console.error(`${name} failed:`, error);
        throw error;
    }
}

// 使用示例
const data = await debugAsyncFunction('fetchUserData', () => 
    fetch('/api/users/123').then(r => r.json())
);
```

### 2. 测试异步代码

```javascript
// Jest测试示例
describe('Async functions', () => {
    test('should fetch user data', async () => {
        const userData = await fetchUserData('123');
        expect(userData).toHaveProperty('id', '123');
    });
    
    test('should handle errors', async () => {
        await expect(fetchUserData('invalid')).rejects.toThrow();
    });
    
    test('should timeout', async () => {
        const slowPromise = new Promise(resolve => 
            setTimeout(resolve, 10000)
        );
        
        await expect(
            withTimeout(slowPromise, 1000)
        ).rejects.toThrow('Operation timeout');
    });
});
```

## 常见陷阱

### 1. 忘记await

```javascript
// 错误：忘记await
async function badExample() {
    const data = fetchData(); // 返回Promise，不是数据
    console.log(data); // 打印Promise对象
}

// 正确：使用await
async function goodExample() {
    const data = await fetchData();
    console.log(data); // 打印实际数据
}
```

### 2. 在Promise构造函数中使用async

```javascript
// 错误：反模式
const promise = new Promise(async (resolve, reject) => {
    try {
        const data = await fetchData();
        resolve(data);
    } catch (error) {
        reject(error);
    }
});

// 正确：直接使用async函数
const betterPromise = (async () => {
    return await fetchData();
})();
```

### 3. 不必要的async/await包装

```javascript
// 错误：不必要的包装
async function unnecessary() {
    return await fetchData();
}

// 正确：直接返回Promise
function better() {
    return fetchData();
}
```

## 总结

JavaScript异步编程的最佳实践包括：

1. **优先使用async/await**：代码更清晰易读
2. **并行处理独立操作**：使用Promise.all()提高性能
3. **正确处理错误**：使用try-catch和适当的错误处理策略
4. **避免常见陷阱**：理解Promise和async/await的工作原理
5. **性能优化**：预加载、缓存、限流等技术
6. **充分测试**：确保异步代码的正确性和健壮性

掌握这些最佳实践将帮助您编写更高效、更可维护的JavaScript异步代码。

---

*异步编程是JavaScript的核心，持续学习和实践是提高技能的关键。* 