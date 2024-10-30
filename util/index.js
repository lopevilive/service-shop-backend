const _ = require('lodash')
const config = require('config')

module.exports.getNowTime = () => {
  return Math.floor(_.now() / 1000)
}

module.exports.getConfig = (key) => {
  const env = config.get('env')
  let ret = config.get(key)
  if (ret[env]) return ret[env]
  return ret

}