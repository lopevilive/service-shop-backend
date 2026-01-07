/**
 * 任务管理类：并发执行任务，优先保留首个返回true的任务结果，支持超时，忽略失败/返回false的任务
 * （无AbortController，任务启动后不强制终止，仅忽略后续结果）
 */
class Manage {
  constructor() {
    this.tasks = []; // 待执行的任务列表（异步函数）
    this.data = null; // 存储首个返回true的任务数据
    this.hasSucceeded = false; // 标记是否已有任务成功返回true
  }

  /**
   * 添加任务
   * @param {Function} task - 异步任务函数，返回Promise，resolve(true/false) 或 reject(错误)
   *                          若返回true，需将数据作为resolve的第二个参数（如resolve([true, 数据])）
   */
  add(task) {
    if (typeof task !== 'function') {
      throw new Error('任务必须是函数（建议为异步函数）');
    }
    this.tasks.push(task);
  }

  /**
   * 执行所有任务
   * @param {number} [timeout=0] - 超时时间（毫秒），0表示无超时
   * @returns {Promise<void>} - 所有任务完成/超时后resolve
   */
  async run(timeout = 0) {
    // 重置执行状态
    this.data = null;
    this.hasSucceeded = false;

    // 无任务直接返回
    if (this.tasks.length === 0) return;

    // 包装任务：执行前检查是否已有成功任务，执行后判断结果是否有效
    const wrappedTasks = this.tasks.map(async (task) => {
      // 若已有任务成功，直接跳过当前任务执行
      if (this.hasSucceeded) return;

      try {
        // 执行任务（无AbortSignal，任务会自然执行完，但结果会被忽略）
        const [isSuccess, taskData] = await task();
        
        // 仅当：无成功任务 + 任务返回true 时，存储数据并标记成功
        if (!this.hasSucceeded && isSuccess === true) {
          this.hasSucceeded = true;
          this.data = taskData;
        }
      } catch (error) {
        // 任务执行出错，直接忽略（可按需添加日志）
        console.warn('任务执行出错，已忽略：', error);
      }
    });

    // 构建超时Promise
    let timeoutId = null;
    const timeoutPromise = new Promise((resolve) => {
      if (timeout <= 0) return resolve();
      
      timeoutId = setTimeout(() => {
        // 超时仅标记流程结束，不终止已启动的任务（结果会被忽略）
        resolve();
      }, timeout);
    });

    try {
      // 等待：所有任务完成 OR 超时（优先触发）
      await Promise.race([
        Promise.all(wrappedTasks), // 等待所有任务执行完成
        timeoutPromise // 超时触发
      ]);
    } finally {
      // 清理超时定时器
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * 获取最终结果
   * @returns {any} - 首个返回true的任务数据，无则返回null
   */
  getData() {
    return this.data;
  }

  /**
   * 清空任务列表（复用实例时使用）
   */
  clearTasks() {
    this.tasks = [];
    this.data = null;
    this.hasSucceeded = false;
  }
}

// ====================== 示例用法 ======================
(async () => {
  // 模拟任务1：2秒后返回true（会被task2抢先，结果忽略）
  const task1 = async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('任务1执行完成（已被忽略）');
        resolve([true, { task: 'task1', result: '任务1成功数据' }]);
      }, 2000);
    });
  };

  // 模拟任务2：1秒后返回true（首个成功，存储数据）
  const task2 = async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('任务2执行完成（成功）');
        resolve([true, { task: 'task2', result: '任务2成功数据' }]);
      }, 1000);
    });
  };

  // 模拟任务3：执行出错（被忽略）
  const task3 = async () => {
    throw new Error('任务3执行失败');
  };

  // 模拟任务4：返回false（被忽略）
  const task4 = async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('任务4执行完成（返回false）');
        resolve([false, null]);
      }, 500);
    });
  };

  // 初始化并添加任务
  const manage = new Manage();
  manage.add(task1);
  manage.add(task2);
  manage.add(task3);
  manage.add(task4);

  // 执行任务，设置超时3秒
  await manage.run(3000);

  // 获取结果
  const data = manage.getData();
  console.log('最终结果：', data); // 输出：{ task: 'task2', result: '任务2成功数据' }
})();