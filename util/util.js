const path = require("path");
const crypto = require('crypto');
const axios = require('axios');
const dayjs = require('dayjs')


module.exports.getNowTime = () => {
  return Math.floor(Date.now() / 1000)
}

/* 安全获取对象嵌套值，路径不存在（undefined/null）返回null，其他值（0/''等）正常返回
 * @param {Object} obj - 目标对象（可传null/undefined）
 * @param {string} path - 嵌套路径，如 'a.b.c'
 * @returns {*} 路径对应值（不存在返回null，存在则返回原值）
 */
module.exports.getNestedValue = (obj, keyPath) => {
  // 1. 基础容错：路径为空/非字符串，直接返回null
  if (!keyPath || typeof keyPath !== 'string') return null;
  // 2. 拆分路径为数组（处理多余的点，如 'a..b' 拆成 ['a','b']）
  const pathArr = keyPath.split('.').filter(key => key.trim() !== '');
  // 3. 路径为空数组，返回null
  if (pathArr.length === 0) return null;
  // 4. 逐层遍历路径，安全取值
  let current = obj;
  for (const key of pathArr) {
    // 只要当前层是undefined/null，直接返回null
    if (current === undefined || current === null) {
      return null;
    }
    // 非对象类型（如数字/字符串）无法继续取值，返回null
    if (typeof current !== 'object' && !Array.isArray(current)) {
      return null;
    }
    // 进入下一层
    current = current[key];
  }
  // 5. 最终值是undefined/null则返回null，否则返回原值
  return current === undefined || current === null ? null : current;
}

module.exports.getConfig = (keyPath) => {
  const cfg = require(path.join(process.cwd(),"config/globalCfg.js"))
  const env = this.getNestedValue(cfg, 'default.env')
  const ret = this.getNestedValue(cfg, keyPath)
  if (ret && ret[env]) return ret[env]
  return ret
}

// 加密字符串
module.exports.encryptAES = (str) => {
  // const validAes192Key = crypto.randomBytes(24).toString('hex');
  // console.log(validAes192Key)
  const aesKeyHex = this.getConfig('default.aesKey');
  const aesKey = Buffer.from(aesKeyHex, 'hex');
  if (aesKey.length !== 24) {
    throw new Error(`AES-192密钥需48个16进制字符（解析后24字节），当前${aesKey.length}字节`);
  }
  // IV必须保留16字节（算法硬性要求，不能改）
  const iv = crypto.randomBytes(16); 
  const cipher = crypto.createCipheriv('aes-192-cbc', aesKey, iv);
  let ret = cipher.update(str, 'utf8', 'hex');
  ret += cipher.final('hex');
  const ivHex = iv.toString('hex'); // 32个字符（固定）
  return ivHex + ret;
}

// 解密字符串
module.exports.deEncryptAES = (ticket) => {
  const aesKeyHex = this.getConfig('default.aesKey');
  const aesKey = Buffer.from(aesKeyHex, 'hex');

  // 提取IV和密文（无分隔符逻辑）
  const ivHex = ticket.slice(0, 32);
  const encryptedStr = ticket.slice(32);
  const iv = Buffer.from(ivHex, 'hex');
  // 修正2：显式声明填充模式（PKCS7，和Node.js默认一致）
  const decipher = crypto.createDecipheriv('aes-192-cbc', aesKey, iv);
  decipher.setAutoPadding(true); // 启用PKCS7填充（默认开启，显式声明更稳定）
  // 解密（16进制→UTF8）
  let rawStr = decipher.update(encryptedStr, 'hex', 'utf8');
  rawStr += decipher.final('utf8');
  return rawStr;
}

// 校验产品容量
module.exports.vailCount = ({level, expiredTime}, count) => {
  count = Number(count)
  const levelCfg = this.getConfig('album.levelCfg')
  const nowTime = this.getNowTime()
  let matchItem = levelCfg.find((item) => item.level === level)
  if (nowTime > expiredTime) {
    matchItem = levelCfg[0] // 过期的情况
  }
  return {
    limit: matchItem.limit,
    curr: count,
    videoLimit: matchItem.videoC,
    videoLimitS: matchItem.videoS,
    pass: matchItem.limit > count,
  }
}

// 并发加载图片
module.exports.loadImg = async (list, limit = 10) => {
  // 1. 预处理队列：过滤掉没有 URL 的项
  const queue = list.filter(item => item.url);
  let index = 0;

  // 2. 定义单个执行单元
  const worker = async () => {
    while (index < queue.length) {
      const item = queue[index++]; // 抢占下一个任务序号
      try {
        let tmp = item.url.replace(/quality\/\d+/, 'quality/20');
        let url = tmp.startsWith('http') ? tmp : `http:${tmp}`;
        const res = await axios({ method: 'get',url, responseType: 'arraybuffer', timeout: 5000 });
        item.img = res.data;
      } catch (e) {
        console.error(`图片加载失败 [${item.url}]:`, e.message);
        item.img = ''; // 失败占位
      }
    }
  };
  const workers = [];
  for (let i = 0; i < Math.min(limit, queue.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
};

// 生成随机数
module.exports.rand = (min, max) => {
  return Math.floor(Math.random() * (max - min)) + min;
}

// 判断是否数字
module.exports.isIntegerString = (str) => {
  return /^[+-]?\d+$/.test(str);
}

/** 格式化时间
 * ts 秒
 * ruleStr 规则，比如YYYY-MM-DD:HH:mm
 */
module.exports.dateTs2Str = (ts, ruleStr) => {
   // 步骤1：秒转毫秒 + 北京时间8小时偏移（UTC+8）
  const beijingTimeMs = ts * 1000 + 8 * 3600 * 1000;
  // 步骤2：基于UTC格式化（彻底脱离服务器时区）
  return dayjs(beijingTimeMs).utc().format(ruleStr);
}

/** 北京时间日期字符串 → 秒级时间戳（不依赖服务器时区）
 * @param {string} dateStr - 格式 YYYY-MM-DD（如 2025-11-25）
 * @returns {number} 秒级时间戳
 */
module.exports.dateStr2Ts = (dateStr) => {
    // 1. 容错处理：非字符串/空值直接返回 NaN
  if (typeof dateStr !== 'string' || !dateStr.trim()) {
    return NaN;
  }
  // 2. 清理输入：去除首尾空格，保证格式统一
  const cleanDateStr = dateStr.trim();
  // 3. 拼接北京时间时区标识（核心：强制按 GMT+0800 解析，避免服务器时区干扰）
  const beijingTimeStr = `${cleanDateStr} GMT+0800`;
  // 4. 解析为 Date 对象并获取毫秒时间戳
  const timestampMs = new Date(beijingTimeStr).getTime();
  // 5. 无效日期判断：解析失败返回 NaN，否则转秒级（舍去毫秒）
  if (isNaN(timestampMs)) {
    return NaN;
  }

  return Math.floor(timestampMs / 1000);
}

module.exports.createOrderId = (type, add_time) => {
  const timeStr = dayjs(add_time * 1000).format('YYYYMMDDHHmm')
  const randNum = this.rand(1000, 9999)
  const timeSub = String(add_time).slice(-6)
  return `${type}${timeStr}${timeSub}${randNum}`
}

// 传入等级和过期时间，计算剩余金额
module.exports.getRestAmount = (level, expiredTime) => {
  const levelCfg = this.getConfig('album.levelCfg')
  let price = 0
  for (const item of levelCfg) {
    if (item.level === level) {
      price = item.price
      break;
    }
  }
  if (price === 0) return 0;
  const nowTime = this.getNowTime()
  if (nowTime > expiredTime) return 0
  const range = expiredTime - nowTime
  const day = Math.ceil(range / (24 * 60 * 60))
  const preDayPrice = Math.floor(price / 365)
  let ret = day * preDayPrice
  ret = Math.ceil(ret / 100) * 100 // 这里向上取整
  return ret
}

// 获取今天0点时间戳，单位 秒
module.exports.getTodayTs = () => {
  const now = Date.now(); // 获取当前的UTC时间戳
  const utc8OffsetMs = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  const oneDayMs = 24 * 60 * 60 * 1000; // 一天的毫秒数
  
  // 1. 将当前UTC时间戳转换为“北京时间戳”
  // 2. 计算这个“北京时间戳”在今天已经过去了多少毫秒
  const millisecondsPassedInUTC8Day = (now + utc8OffsetMs) % oneDayMs;
  
  // 3. 用当前UTC时间戳减去“已过时间”，得到今天北京时间零点那一刻的UTC时间戳
  const utcTimestampOfUTC8Midnight = now - millisecondsPassedInUTC8Day;
  
  return utcTimestampOfUTC8Midnight / 1000;
}

module.exports.sleep = async (times) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, times);
  })
}


// 同时跑多个异步任务​，只要有一个成功，立刻返回结果
module.exports.ConcurrencyManage = class ConcurrencyManage {
  constructor() {
    this.taskList = []
    this.status = 'idle' // doing done
    this.data = null
    this.resolve = null
    this.reject = null
    this.doneNums = 0
    this.timer = null
    this.p = null
  }

  add(fn) {
    if (this.status !== 'idle') return
    this.taskList.push(async () => {
      try {
        const ret = await fn()
        if ([false, undefined].includes(ret)) return
        if (this.status === 'done') return
        this.status = 'done'
        clearTimeout(this.timer)
        this.data = ret
        this.resolve(this.data)
      } catch(e) {
        
      } finally {
        this.doneNums += 1
        if (this.doneNums === this.taskList.length) { // 全部执行完了
          if (this.status === 'done') return
          this.status = 'done'
          clearTimeout(this.timer)
          this.resolve(this.data)
        }
      }
    })
  }
  async run(timeout = 3000) {
    if (this.status === 'done') return Promise.resolve(this.data)
    if (this.status === 'doing') return this.p
    this.status = 'doing'
    this.p = new Promise((a, b)=> {
      this.resolve = a
      this.reject = b
    })
    if (this.taskList.length === 0) return Promise.resolve(this.data)
    for(const fn of this.taskList) {
      fn()
    }
    this.timer = setTimeout(() => {
      if (this.status === 'done') return
      this.status = 'done'
      this.resolve(this.data)
    }, timeout);

    return this.p
  }
}

/** 字符串数组分段拼接【精准分情况超长处理】
 * @param {string[]} strArr 原始字符串数组 例：['123','456','asd']
 * @param {number} [maxLen=2000] 每一项最大字符长度，可配置，默认2000
 * @returns {string[]} 处理后的数组，每项≤maxLen，兼顾完整性+合规性
 */
module.exports.joinStrArrayWithLimit = (strArr, maxLen = 2000) => {
  // 边界值处理：非数组返回空、非法长度重置为2000、最小长度限制1
  if (!Array.isArray(strArr) || strArr.length === 0) return [];
  const limit = typeof maxLen === 'number' && maxLen >= 1 ? maxLen : 2000;
  const connector = '。'; // 连接符，严格算1个字符
  const result = [];
  let currentStr = ''; // 当前正在拼接的字符串

  // 【专用工具方法】仅当「单个字符串本身超长」时调用，强制切割成合规片段，不浪费长度
  const splitOverLengthStr = (longStr) => {
    const segments = [];
    let startIndex = 0;
    // 循环切割，每段严格等于/小于最大长度，保证绝对合规
    while (startIndex < longStr.length) {
      const endIndex = startIndex + limit;
      segments.push(longStr.substring(startIndex, endIndex));
      startIndex = endIndex;
    }
    return segments;
  };

  // 遍历原始数组，逐个处理
  strArr.forEach(item => {
    // 过滤空值：undefined/null/空字符串/纯空格，直接跳过不拼接
    const currItem = item?.toString().trim() || '';
    if (!currItem) return;

    let waitJoinItems = [];
    // 分情况初始化待拼接的内容：判断当前项是否本身超长
    if (currItem.length > limit) {
      // 情况①：单个项本身超长 → 仅此时切割，切成合规片段
      waitJoinItems = splitOverLengthStr(currItem);
    } else {
      // 情况②：单个项本身合规 → 不切割，保留完整字符串，直接待拼接
      waitJoinItems = [currItem];
    }

    // 遍历待拼接的内容（可能是完整项，也可能是超长项切割后的片段）
    waitJoinItems.forEach(waitItem => {
      if (currentStr === '') {
        // 当前无拼接内容，直接赋值
        currentStr = waitItem;
      } else {
        // 核心计算：当前串 + 连接符(1字符) + 待拼接项 的总长度
        const totalNeedLen = currentStr.length + 1 + waitItem.length;
        if (totalNeedLen <= limit) {
          // 总长度合规 → 正常拼接，保留完整性
          currentStr += connector + waitItem;
        } else {
          // 总长度超了 → 把当前串推入结果，待拼接项【完整独立】作为新的拼接起点
          result.push(currentStr);
          currentStr = waitItem;
        }
      }
    });
  });

  // 最后把剩余的拼接串推入结果，防止遗漏末尾内容
  if (currentStr) {
    result.push(currentStr);
  }

  return result;
}


// 过滤 emoji
module.exports.emojiReplaceStr = (str) => {
  if (!str) return '';
  return str.replace(/[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF][\u200D|\uFE0F]|[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF]|[0-9|*|#]\uFE0F\u20E3|[0-9|#]\u20E3|[\u203C-\u3299]\uFE0F\u200D|[\u203C-\u3299]\uFE0F|[\u2122-\u2B55]|\u303D|[\A9|\AE]\u3030|\uA9|\uAE|\u3030/ig, '');
};

// 并发器
module.exports.SmartLimiter = class SmartLimiter {
  /**
   * @param {Object} options
   * @param {number} options.maxConcurrent 最大并发数（同时在跑的请求数）
   * @param {number} options.maxPerSecond 每秒允许的最大请求数（QPS）
   */
  constructor({ maxConcurrent = 10, maxPerSecond = 50 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.maxPerSecond = maxPerSecond;

    this.currentCount = 0; // 当前正在执行的任务数
    this.queue = [];        // 任务队列

    // 用于速率限制的计数器
    this.currentWindowRequests = 0; 
    this.lastWindowTimestamp = Date.now();
  }

  /**
   * 执行任务
   * @param {Function} taskFn 返回 Promise 的函数
   */
  async run(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this.next();
    });
  }

  /**
   * 核心调度逻辑
   */
  next() {
    // 1. 如果队列空了，直接返回
    if (this.queue.length === 0) return;

    // 2. 检查【并发限制】
    if (this.currentCount >= this.maxConcurrent) return;

    // 3. 检查【速率限制】
    const now = Date.now();
    // 如果已经过了 1 秒（1000ms），重置时间窗口和计数器
    if (now - this.lastWindowTimestamp >= 1000) {
      this.lastWindowTimestamp = now;
      this.currentWindowRequests = 0;
    }

    // 如果在当前 1 秒的时间窗口内，请求数已经达到了上限
    if (this.currentWindowRequests >= this.maxPerSecond) {
      // 计算距离进入下一个 1 秒窗口还需要多少毫秒
      const delay = 1000 - (now - this.lastWindowTimestamp);
      // 延迟触发下一次检查，不阻塞当前线程
      setTimeout(() => this.next(), delay);
      return;
    }

    // 4. 校验通过，取出任务并执行
    const { taskFn, resolve, reject } = this.queue.shift();
    
    this.currentCount++;
    this.currentWindowRequests++;

    taskFn()
      .then(res => resolve(res))
      .catch(err => reject(err))
      .finally(() => {
        this.currentCount--;
        // 某个任务结束了，或者并发空出来了，立刻尝试调度下一个
        this.next();
      });

    // 只要拿出了一个任务，且队列里还有，就继续尝试看能不能连着发（满足 QPS 和并发的前提下）
    if (this.queue.length > 0) {
      setImmediate(() => this.next());
    }
  }
}

// 记录审核次数记录
module.exports.secCheckCount = async (logType) => {
  try {
    const dao = require(path.join(process.cwd(),"dao/DAO"));
    const manager = await dao.getManager()
    await manager.transaction(async (transactionalEntityManager) => {
      const instance = await transactionalEntityManager.createQueryBuilder('CusLogs', 'CusLogs');
      instance.setLock('pessimistic_write');
      instance.where('CusLogs.logType = :logType', {logType});
      const data = await instance.getOne()
      if (!data) {
        await transactionalEntityManager.save('CusLogs', { logType, add_time: this.getNowTime(), content: '1'})
      } else {
        const {id, content} = data
        let count = Number(content) + 1
        await transactionalEntityManager.update('CusLogs', {id}, {content: String(count), upd_time: this.getNowTime()})
      }
    })
  } catch(e) {
    console.log(e)
  }
}

module.exports.QrCodeManage = class QrCodeManage {
  constructor() {
    this.QRCode = require('qrcode');
  }
  
  // 生成单个二维码
  async getSingleQr(str) {
    const ret = await this.QRCode.toDataURL(str, {width: 300, margin: 2})
    return ret
  }


}
