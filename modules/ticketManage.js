const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));



// expired 有效期，单位秒，例子：1天 = 60 * 60 * 24 * 1
module.exports.createTicket = async (str, expired) => {
  if (!str) str = 'none'
  const obj = util.encryptAES(str, expired)
  await dao.create('Ticket', obj)
  return obj.content
}

module.exports.verifyTicket = async (ticket) => {
  try {
    let res = await dao.list('Ticket', {columns: {content: ticket}})
    if (res.length !== 1) return {status: -1}
    const {content, random, expiredTime} = res[0]
    if (util.getNowTime() >= expiredTime) return {status: -2} // 过期
    const rawStr = util.deEncryptAES(content, random, expiredTime)
    return { status: 0, rawStr}
  } catch(e) {
    return {
      status: -1, // 无效ticket
    }
  }
  
  
}