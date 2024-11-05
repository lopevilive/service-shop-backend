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

// expired 有效期，单位秒，例子：1天 = 60 * 60 * 24 * 1
module.exports.encryptAES = (str, expired) => {
  if (!expired) expired = 60 * 15 // 默认 15 分钟
  const expiredTime = this.getNowTime() + expired
  const aesKey = this.getConfig('aesKey')
  const random = _.random(1, 10000) // 随机数
  const salt = `${aesKey}${expiredTime}${random}`
  const cipher = crypto.createCipher('aes192', salt);
  var content = cipher.update(str, 'utf8', 'hex');
  content += cipher.final('hex');
  return { expiredTime, content, random }
}

module.exports.deEncryptAES = (content,random, expiredTime) => {
  const aesKey = this.getConfig('aesKey')
  const salt = `${aesKey}${expiredTime}${random}`
  const decipher = crypto.createDecipher('aes192', salt);
  var str = decipher.update(content, 'hex', 'utf8');
  str += decipher.final('utf8');
  return str;
}