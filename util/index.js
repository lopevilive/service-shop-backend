const _ = require('lodash')

module.exports.getNowTime = () => {
  return Math.floor(_.now() / 1000)
}