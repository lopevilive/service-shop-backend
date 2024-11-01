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
  const key = this.getConfig('aesKey')
  const cipher = crypto.createCipher('aes192', key);
  var crypted = cipher.update(str, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

module.exports.deEncryptAES = (crypted) => {
  const key = this.getConfig('aesKey')
  const decipher = crypto.createDecipher('aes192', key);
  var str = decipher.update(crypted, 'hex', 'utf8');
  str += decipher.final('utf8');
  return str;
}