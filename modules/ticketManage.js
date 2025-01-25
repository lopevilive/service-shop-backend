const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))


// expired 有效期，单位秒，例子：1天 = 60 * 60 * 24 * 1
module.exports.createTicket = (str, expired) => {
  if (!expired) expired = 60 * 15 // 默认 15 分钟
  const expiredTime = util.getNowTime() + expired
  const random = Math.floor(Math.random() * 10000)
  let encryStr = `${str}/${expiredTime}/${random}`
  const ticket = util.encryptAES(encryStr)
  return ticket
}

/**
 * 
 * advanceExpire 提前过期。单位秒
 */
module.exports.verifyTicket = (ticket, advanceExpire = 0) => {
  try {
    const res = util.deEncryptAES(ticket)
    let [rawStr, expiredTime] = res.split('/')
    expiredTime = +expiredTime
    if (Number.isNaN(expiredTime)) throw new Error('token 非法')
    if ((util.getNowTime() + advanceExpire) >= expiredTime) {
      return {status: -2, err: new Error('已过期')}
    }
    return {status: 0, rawStr}
  } catch(e) {
    return { status: -1, err: e}
  }
}