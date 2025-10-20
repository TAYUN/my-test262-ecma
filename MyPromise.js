const PROMISE_STATUS_PENDING = "pending";
const PROMISE_STATUS_FULFILLED = "fulfilled";
const PROMISE_STATUS_REJECTED = "rejected";
// 工具函数 减少try catch 使用
function tryCatchFn(execFn, value, resolve, reject) {
  try {
    const result = execFn(value);
    resolve(result);
  } catch (err) {
    reject(err);
  }
}
// 判断对象是否可迭代
function isIterable(obj) {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj[Symbol.iterator] === "function"
  );
}

// Promise解析程序
function resolvePromise(promise, value, resolve, reject) {
  // 1. x 与 MyPromise 相等 防止传入自身的时候，无限循环 自引用检测
  if (value === promise) {
    return reject(new TypeError("循环引用"));
  }
  // 2. 如果 value 是 MyPromise 实例，需要特殊处理
  if (value instanceof MyPromise) {
    // 把当前实例的状态挂靠到 value 上
    // value.then(resolve, reject); // 这个有问题
    // 根据 ECMAScript 规范，当 Promise 被另一个 Promise 解决时，需要额外的微任务
    // 这里需要两个微任务来匹配原生 Promise 的行为
    queueMicrotask(() => {
      queueMicrotask(() => {
        value.then(resolve, reject);
      });
    });
    return;
  }
  // 3. 如果 value 是对象或者函数
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "function")
  ) {
    let then;
    try {
      then = value.then;
    } catch (e) {
      return reject(e);
    }
    // 如果 then 是函数，则当作 thenable 处理
    if (typeof then === "function") {
      let called = false;
      try {
        // 根据 ECMAScript 规范，thenable 的调用应该在微任务中执行
        queueMicrotask(() => {
          try {
            then.call(
              value,
              (y) => {
                if (called) return;
                called = true;
                resolvePromise(promise, y, resolve, reject); // 递归调用resolvePromise处理返回值
              },
              (r) => {
                if (called) return;
                called = true;
                reject(r);
              },
            );
          } catch (e) {
            if (!called) reject(e);
          }
        });
      } catch (e) {
        if (!called) reject(e);
      }
      return; // 进入 thenable 解析
    }
  }
  // 4. 普通值直接resolve
  resolve(value);
}

class MyPromise {
  constructor(executor) {
    // 设置默认状态 pending
    this.status = PROMISE_STATUS_PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledFns = [];
    this.onRejectedFns = [];

    const resolve = (value) => {
      // 状态只能改变一次
      if (this.status === PROMISE_STATUS_PENDING) {
        // 使用 resolvePromise 处理复杂的解析逻辑
        resolvePromise(
          this,
          value,
          (resolvedValue) => {
            this.status = PROMISE_STATUS_FULFILLED;
            this.value = resolvedValue;
            // console.log("resolve被调用");
            queueMicrotask(() => {
              // console.log("queueMicrotask-resolve-then");
              //将成功的回调和失败的回调放到数组中，统一对应调用
              this.onFulfilledFns.forEach((fn) => {
                fn(this.value);
              });
            });
          },
          reject,
        );
      }
    };
    const reject = (reason) => {
      // console.log("reject被调用");
      // 状态只能改变一次
      if (this.status === PROMISE_STATUS_PENDING) {
        this.status = PROMISE_STATUS_REJECTED;
        this.reason = reason;
        // console.log("reject被调用");
        queueMicrotask(() => {
          // console.log("queueMicrotask-reject-then");
          //将成功的回调和失败的回调放到数组中，统一对应调用
          this.onRejectedFns.forEach((fn) => {
            fn(this.reason);
          });
        });
      }
    };

    try {
      executor(resolve, reject); // 进来立即执行 executor
    } catch (err) {
      reject(err);
    }
  }

  // 实例方法
  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      // 值穿透：决定“下一个” Promise 拿到 val 以后，要不要原样再往下传。 如果没传回调，就透传 value / reason
      if (typeof onFulfilled !== "function") {
        onFulfilled = (val) => val;
      }
      if (typeof onRejected !== "function") {
        // 直接抛出错误，实现错误穿透
        onRejected = (err) => {
          throw err;
        };
      }

      if (this.status === PROMISE_STATUS_FULFILLED) {
        queueMicrotask(() =>
          tryCatchFn(onFulfilled, this.value, resolve, reject),
        );
      } else if (this.status === PROMISE_STATUS_REJECTED) {
        queueMicrotask(() =>
          tryCatchFn(onRejected, this.reason, resolve, reject),
        );
      } else {
        this.onFulfilledFns.push(() =>
          queueMicrotask(() =>
            tryCatchFn(onFulfilled, this.value, resolve, reject),
          ),
        );
        this.onRejectedFns.push(() =>
          queueMicrotask(() =>
            tryCatchFn(onRejected, this.reason, resolve, reject),
          ),
        );
      }
    });
  }

  // catch方法是 Promise.prototype.then(undefined, onRejected) 的一种简写形式。
  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (val) => MyPromise.resolve(onFinally()).then(() => val),
      (err) =>
        MyPromise.resolve(onFinally()).then(() => {
          throw err;
        }),
    );
    // return this.then(onFinally, onFinally); // 错误的
  }

  // 静态方法 只需要将包裹后的值返回出去，作为后续链式调用依靠
  static resolve(value) {
    return new MyPromise((resolve) => resolve(value));
  }
  static reject(reason) {
    return new MyPromise((resolve, reject) => reject(reason));
  }

  static all(promises) {
    if (!isIterable(promises)) {
      return MyPromise.reject(new TypeError("参数必须是一个可迭代对象"));
    }
    const promisesArr = Array.from(promises);
    const len = promisesArr.length;
    if (!len) return MyPromise.resolve([]);
    return new MyPromise((resolve, reject) => {
      const values = [];
      let count = len;
      promisesArr.forEach((promise, index) => {
        promise.then((val) => {
          values[index] = val;
          if (--count === 0) resolve(values);
        }, reject);
      });
    });
  }

  static allSettled(promises) {
    if (!isIterable(promises)) {
      return MyPromise.reject(new TypeError("参数必须是一个可迭代对象"));
    }
    // 问题关键: 什么时候要执行resolve, 什么时候要执行reject
    const promisesArr = Array.from(promises);
    const len = promisesArr.length;
    if (!len) return MyPromise.resolve([]);
    return new MyPromise((resolve, reject) => {
      const values = [];
      let count = len;
      promisesArr.forEach((promise, index) => {
        promise.then(
          (val) => {
            values[index] = { status: PROMISE_STATUS_FULFILLED, value: val };
            if (--count === 0) resolve(values);
          },
          (err) => {
            values[index] = { status: PROMISE_STATUS_REJECTED, reason: err };
            if (--count === 0) resolve(values);
          },
        );
      });
    });
  }

  static race(promises) {
    if (!isIterable(promises)) {
      return MyPromise.reject(new TypeError("参数必须是一个可迭代对象"));
    }
    const promisesArr = Array.from(promises);
    const len = promisesArr.length;
    if (!len) return MyPromise.resolve([]);
    return new MyPromise((resolve, reject) => {
      promisesArr.forEach((promise) => {
        promise.then(resolve, reject);
      });
    });
  }

  static any(promises) {
    if (!isIterable(promises)) {
      return MyPromise.reject(new TypeError("参数必须是一个可迭代对象"));
    }
    // resolve必须等到有一个成功的结果
    // reject所有的都失败才执行reject
    const promisesArr = Array.from(promises);
    const len = promisesArr.length;
    if (!len) return MyPromise.resolve([]);
    return new MyPromise((resolve, reject) => {
      const reasons = [];
      let count = len;
      promisesArr.forEach((promise, index) => {
        promise.then(resolve, (err) => {
          reasons[index] = err;
          if (--count === 0) {
            const AggregateError =
              globalThis.AggregateError ||
              function (errs) {
                const e = new Error("All promises rejected");
                e.errors = errs;
                return e;
              };
            reject(new AggregateError(reasons));
          }
        });
      });
    });
  }

  // 添加 Symbol.toStringTag 以改善调试体验
  get [Symbol.toStringTag]() {
    return 'Promise';
  }
}

module.exports = MyPromise;
