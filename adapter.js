// Test262 适配器 - 将 MyPromise 替换全局 Promise
// 这是标准的 Test262 适配器写法

// 导入你的 MyPromise 实现
const MyPromise = require('d:/myfile/test262/MyPromise.js');

// 获取全局对象（兼容不同环境）
const globalObj = (function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})();

// 备份原生 Promise（可选，用于调试）
const NativePromise = globalObj.Promise;

// 将 MyPromise 挂载到全局，替换原生 Promise
globalObj.Promise = MyPromise;

// 修复 Promise.name 属性以符合 Test262 期望
Object.defineProperty(MyPromise, 'name', {
  value: 'Promise',
  writable: false,
  enumerable: false,
  configurable: true
});
