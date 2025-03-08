const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));
const ticketManage = require(path.join(process.cwd(),"modules/ticketManage"));
const axios = require('axios');


const getAppInfo = async (code) => {
  try {
    const {appid, secret} = util.getConfig('appInfo')
    const reqPayload = {appid, secret, js_code: code, grant_type: 'authorization_code'}
    const {data} = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {params: reqPayload})
    return data
  } catch(e) {
    console.log(`jscode2sessionErr:${e.message || e.msg}`)
    throw e
  }
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
    const token = ticketManage.createTicket(openid, 60 * 60 * 24 * 180)
    cb(null, token)
  } catch(e) {
    cb(e)
  }
}

module.exports.getUserInfo = async (req, cb) => {
  try {
    const {id: userId, phone} = req.userInfo
    const ret = {userId, hasPhone: false}
    const ownerList = await dao.list('Shop', {columns: {userId}})
    const adminList = await dao.list('Staff', {columns: {userId, type: 1, status: 4}})
    ret['ownerList'] = ownerList.map((item) => item.id)
    ret['adminList'] = adminList.map((item) => item.shopId)
    ret['isSup'] = util.getConfig('superAdmin').includes(userId)
    ret['demoShops'] = util.getConfig('demoShops')
    if (phone) ret['hasPhone'] = true
    cb(null, ret)
  } catch(e) {
    console.error(e)
    cb(e)
  }
}

module.exports.bindPhone = async (req, cb) => {
  try {
    const {appid, secret} = util.getConfig('appInfo')
    const { code, token } = req.body
    // 获取 access_tokenRes
    const access_tokenRes = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {params: {appid, secret, grant_type: 'client_credential'}})
    const {access_token, expires_in} = access_tokenRes.data
    // 校验 token
    const {status, rawStr} = ticketManage.verifyTicket(token)
    if (status !== 0) throw new Error('token 失效')
    const openid = rawStr
    let url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${access_token}`
    // 获取号码
    const {data} = await axios.post(url, {code})
    if (data.errcode !== 0) throw new Error(data.errmsg || '电话解析失败')
    let {phone_info: {phoneNumber, purePhoneNumber, countryCode}} = data
    if (!countryCode) countryCode = ''
    let userInfo = await dao.list('User', {columns: {openid}})
    if (userInfo.length !== 1) throw new Error('用户信息获取失败')
    userInfo = userInfo[0]
    await dao.update('User', userInfo.id, {phone: purePhoneNumber, countryCode})
    cb(null)
  } catch(e) {
    console.error(e)
    cb(e)
  }
}

module.exports.veriToken = async (req, cb) => {
  let resolve = null;
  let done = false
  let p = new Promise((a) => {
    resolve = a
  })

  const initDb = async () => {
    await dao.connect() // 激活 db
    if (!done) {
      done = true
      resolve()
    }
  }
  const maxTime = () => {
    setTimeout(() => {
      if (!done) {
        done = true
        resolve()
      }
    }, 1500);
  }

  initDb()
  maxTime()

  try {
    await p
  } catch(e) {}
  const {token} = req.body
  const {status} = ticketManage.verifyTicket(token, 60 * 60 * 24 * 1) // 提前 1 天刷新token
  if (status === 0) {
    cb(null)
  } else {
    cb(new Error(status))
  }
}