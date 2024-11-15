const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));
const ticketManage = require(path.join(process.cwd(),"modules/ticketManage"));
const axios = require('axios')


const getAppInfo = async (code) => {
  const {appid, secret} = util.getConfig('appInfo')
  const reqPayload = {appid, secret, js_code: code, grant_type: 'authorization_code'}
  const {data} = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {params: reqPayload})
  console.log(data, 'rrrrrr')
  return data
  // return {
  //   session_key: '123', // 会话密钥
  //   unionid: '', // 未绑定公众平台，不返回
  //   errmsg: '',
  //   openid: '111111',
  //   errcode: ''
  // }
}

module.exports.login = async (req, cb) => {
  try {
    const { code } = req.body
    const {openid} = await getAppInfo(code)
    if (!openid) {
      cb(new Error('获取openid 失败'))
      return
    }
    const res = await dao.list('User', {columns: {openid}})
    if (res.length === 0) { // 新用户,先创建
      await dao.create('User', {openid, openid, add_time: util.getNowTime()})
    }
    const token = await ticketManage.createTicket(openid, 60 * 60 * 24 * 180)
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
    const adminList = await dao.list('Staff', {columns: {userId, type: 1, status: 4}})
    ret['ownerList'] = ownerList.map((item) => item.id)
    ret['adminList'] = adminList.map((item) => item.shopId)
    ret['isSup'] = util.getConfig('superAdmin').includes(userId)
    cb(null, ret)
  } catch(e) {
    console.error(e)
    cb(e)
  }
}