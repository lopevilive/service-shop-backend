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
    const res = await dao.list('User', {columns: {unionid}})
    if (res.length === 0) { // 新用户,先创建
      await dao.create('User', {unionid, openid, add_time: util.getNowTime()})
    }
    const token = util.encryptAES(unionid)
    cb(null, token)
  } catch(e) {
    cb(e)
  }
}

module.exports.getUserInfo = async (req, cb) => {
  try {
    const {id: userId} = req.userInfo
    const ret = {userId}
    const ownerList = await dao.list('Shop', {columns: {userId}})
    const adminList = [] // todo
    ret['ownerList'] = ownerList.map((item) => item.id)
    ret['adminList'] = adminList.map((item) => item.id)
    cb(null, ret)
  } catch(e) {
    console.error(e)
    cb('登录失效，请重新登录')
  }
}