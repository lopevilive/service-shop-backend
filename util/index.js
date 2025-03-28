const path = require("path");
const _ = require('lodash')
const config = require('config')
const crypto = require('crypto');
const axios = require('axios');
const dayjs = require('dayjs')

module.exports.getNowTime = () => {
  return Math.floor(_.now() / 1000)
}

module.exports.getConfig = (key) => {
  const env = config.get('env')
  let ret = config.get(key)
  if (ret[env]) return ret[env]
  return ret
}

module.exports.encryptAES = (str) => {
  const aesKey = this.getConfig('aesKey')
  const cipher = crypto.createCipher('aes192', aesKey);
  let ret = cipher.update(str, 'utf8', 'hex');
  ret += cipher.final('hex');
  return ret
}

module.exports.deEncryptAES = (ticket) => {
  const aesKey = this.getConfig('aesKey')
  const decipher = crypto.createDecipher('aes192', aesKey);
  let rawStr = decipher.update(ticket, 'hex', 'utf8');
  rawStr += decipher.final('utf8');
  return rawStr
}

module.exports.vailCount = (level, count) => {
  count = Number(count)
  const levelCfg = this.getConfig('levelCfg')
  const matchItem = levelCfg.find((item) => item.level === level)
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
    let url = `http:${item.url}`
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
    if (countRes && countRes[0] && countRes[0].total >= 5) { // 产品数量5个以内要审核
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

  if (score >= 60) { // 记录本次审核
    let logType = score < 90 ? 2 : 3
    await dao.create('CusLogs', {
      logType, userId,
      add_time: this.getNowTime(),
      content: JSON.stringify(audRes),
      shopId: shopId ? shopId : 0
    })
  }

  if (score >= 90) { // 违规了
    await dao.update('User', userId, {status: 1}) // 用户加入黑名单
    if (shopId) {
      await dao.update('Shop', shopId, {status: 1, auditing: 2}) // 封禁画册
    }
    return 1
  }
  if (score >= 60) { // 敏感
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

module.exports.createOrderId = (type, add_time) => {
  const timeStr = dayjs(add_time * 1000).format('YYYYMMDDHHmm')
  const randNum = this.rand(1000, 9999)
  const timeSub = String(add_time).slice(-6)
  return `${type}${timeStr}${timeSub}${randNum}`
}