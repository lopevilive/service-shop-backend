const _ = require('lodash')
const config = require('config')
const crypto = require('crypto');

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