const path = require("path");
const _ = require('lodash')
const config = require('config')
const crypto = require('crypto');
const axios = require('axios');
const dayjs = require('dayjs')


module.exports.getNowTime = () => {
  return Math.floor(_.now() / 1000)
}

/**
 * 安全获取对象嵌套值，路径不存在（undefined/null）返回null，其他值（0/''等）正常返回
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

// module.exports.getConfig = (key) => {
//   const env = config.get('env')
//   let ret = config.get(key)
//   if (ret[env]) return ret[env]
//   return ret
// }

module.exports.getConfig = (keyPath) => {
  const cfg = require(path.join(process.cwd(),"config/globalCfg.js"))
  const env = this.getNestedValue(cfg, 'default.env')
  const ret = this.getNestedValue(cfg, keyPath)
  if (ret && ret[env]) return ret[env]
  return ret
}

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
    pass: matchItem.limit > count
  }
}

module.exports.loadImg = async (list) => {
  let reso
  let p = new Promise((resolve) => {
    reso = resolve
  })
  let num = 0
  for (const item of list) {
    let tmp = item.url
    tmp = tmp.replace(/quality\/\d+/,'quality/2')
    let url = `http:${tmp}`
    axios({
      method: 'get', url, responseType: 'arraybuffer'
    }).then((res) => {
      num += 1
      item.img = res.data
      if (num === list.length) reso()
    }).catch((e) => {
      num += 1
      item.img = ''
      console.error(e)
      if (num === list.length) reso()
    })
  }
  return p
}

module.exports.rand = (min, max) => {
  return Math.floor(Math.random() * (max - min)) + min;
}

// 是否需要审核图片
module.exports.isNeedAudImg = async (shopId) => {
  const dao = require(path.join(process.cwd(),"dao/DAO"));
  if (!shopId) return true // 一般是新建画册的时候，必须审核
  let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
  const {auditing} = shopInfo[0]
  if (auditing === 2) return true
  if (auditing === 99) return false
  if (auditing === 0) {
    const countRes = await dao.count('Product', {shopId})
    if (countRes && countRes[0] && countRes[0].total >= 1) { // 产品数量5个以内要审核
      await dao.update('Shop', shopId, {auditing: 1})
      return true
    } 
  }
  if (auditing === 1) { // 概率审核
    return true
    // const n = this.rand(0, 100)
    // return n > 95 ? true: false
  } 
  return true // 兜底审核
}

module.exports.handleAudRes = async (audRes, shopId, userId) => {
  const dao = require(path.join(process.cwd(),"dao/DAO"));
  let countRes = await dao.list('CusLogs', {columns: {logType: 1}})
  if (countRes.length === 0) {
    await dao.create('CusLogs', {logType: 1, add_time: this.getNowTime(), content: '1'})
  } else {
    const {id, content} = countRes[0]
    let count = Number(content) + 1
    await dao.update('CusLogs', id, {upd_time: this.getNowTime(), content: String(count)})
  }
  const {RecognitionResult: {PornInfo}} = audRes
  let score = Number(PornInfo.Score)

  if (score >= 97) { // 记录本次审核
    // let logType = score < 90 ? 2 : 3
    let logType = 3
    await dao.create('CusLogs', {
      logType, userId,
      add_time: this.getNowTime(),
      content: JSON.stringify(audRes),
      shopId: shopId ? shopId : 0
    })
  }

  if (score >= 97) { // 违规了
    await dao.update('User', userId, {status: 1}) // 用户加入黑名单
    if (shopId) {
      await dao.update('Shop', shopId, {status: 1, auditing: 2}) // 封禁画册
    }
    return 1
  }
  if (score >= 80) { // 敏感
    if (shopId) {
      await dao.update('Shop', shopId, { auditing: 2}) // 画册持续审核
    }
  }

  return 0
}

// 判断是否数字
module.exports.isIntegerString = (str) => {
  return /^[+-]?\d+$/.test(str);
}

/**
 * 格式化时间
 * ts 秒
 * ruleStr 规则，比如YYYY-MM-DD:HH:mm
 */
module.exports.dateTs2Str = (ts, ruleStr) => {
   // 步骤1：秒转毫秒 + 北京时间8小时偏移（UTC+8）
  const beijingTimeMs = ts * 1000 + 8 * 3600 * 1000;
  // 步骤2：基于UTC格式化（彻底脱离服务器时区）
  return dayjs(beijingTimeMs).utc().format(ruleStr);
}

/**
 * 北京时间日期字符串 → 秒级时间戳（不依赖服务器时区）
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

module.exports.generateNonceStr = (len) => {
  let data = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
  let str = "";
  for (let i = 0; i < len; i++) {
      str += data.charAt(Math.floor(Math.random() * data.length));
  }
  return str;
}

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

module.exports.getVipPrice = (level) => {
  const levelCfg = this.getConfig('album.levelCfg')
  for (const item of levelCfg) {
    if (item.level === level) return item.price
  }
  return 0
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

/**
 * 检查时间戳是否有效期
 * ts 时间戳 单位秒，为空或者过期都会返回false
 * num 有效期，单位秒
 */

module.exports.validTs = (ts, num) => {
  if (!ts) return false
  const t = Number(ts)
  const nowTs = this.getNowTime()
  const range = nowTs - t
  if (range >= num) return false
  return true
}

/**
 * 按5的倍数区间中间值取整（≥中间值返回上一个5的倍数，<中间值返回下一个）
 * 兼容数字/字符串输入，统一返回字符串格式（如44→"45"、42→"40"、-166→"-165"）
 */
module.exports.roundDownToMultipleOfFive = (num) => {
    // 1. 统一转换输入为数字并校验类型
  let numVal;
  if (typeof num === 'number' || typeof num === 'string') {
    numVal = Number(num);
  } else {
    console.warn('输入必须是数字或字符串格式的数字');
    return "";
  }
  // 2. 校验是否为有效数字
  if (isNaN(numVal)) {
    console.warn('输入无法转换为有效数字');
    return "";
  }
  // 3. 核心逻辑：按5的倍数中间值取整（等价于四舍五入）
  // 原理：num/5后四舍五入，再乘5（如44/5=8.8→9→45；42/5=8.4→8→40；-166/5=-33.2→-33→-165）
  const resultNum = Math.round(numVal / 5) * 5;
  return resultNum.toString();
}

class ConcurrencyManage {
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

module.exports.ConcurrencyManage = ConcurrencyManage

/**
 * 移除行政区划后缀（省/市/自治区/特别行政区等）
 * @param {string} region - 带后缀的地区名称（如：广东省、北京市、广西壮族自治区）
 * @returns {string} 移除后缀后的纯地区名（如：广东、北京、广西壮族）
 */
module.exports.removeRegionSuffix = (region) => {
  // 1. 容错处理：非字符串/空值直接返回空字符串
  if (typeof region !== 'string' || !region.trim()) {
    return '';
  }
  // 2. 定义需要移除的行政区划后缀（按「长后缀优先」排序，避免短后缀匹配覆盖长后缀）
  const suffixes = [ '特别行政区', '自治区','自治州', '自治县', '省', '市', '盟', '地区'];
  let result = region.trim();
  // 3. 遍历后缀，匹配到则移除
  for (const suffix of suffixes) {
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
      break; // 匹配到一个后缀后立即退出，避免重复移除
    }
  }
  return result;
}