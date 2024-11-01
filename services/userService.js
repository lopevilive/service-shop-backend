const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));


const getAppInfo = async (payload) => {
  // todo
  return {
    session_key: '123', // 会话密钥
    unionid: '1234567',
    errmsg: '',
    openid: '111111',
    errcode: ''
  }
}

module.exports.login = async (params, cb) => {
  try {
    const {unionid, openid} = await getAppInfo()
    const res = await dao.list('User', {unionid})
    if (res.length === 0) { // 新用户,先创建
      await dao.create('User', {unionid, openid, add_time: util.getNowTime()})
    }
    const token = util.encryptOpenId(unionid)
    cb(null, token)
  } catch(e) {
    cb(e)
  }
}