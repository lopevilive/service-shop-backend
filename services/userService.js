const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));
const ticketManage = require(path.join(process.cwd(),"modules/ticketManage"));
const axios = require('axios');
const pay = require(path.join(process.cwd(),"modules/pay"));
const wxApi = require(path.join(process.cwd(),"modules/wxApi"))


module.exports.login = async (req, cb) => {
  try {
    const { code } = req.body
    const {appid, secret} = util.getConfig('album.appInfo')
    const token = await wxApi.login({code, appid, secret, dbName: 'User'})
    cb(null, token)
  } catch(e) {
    cb(e)
  }
}

module.exports.getUserInfo = async (req, cb) => {
  try {
    const {id: userId, phone, viewLogs} = req.userInfo
    const ret = {userId, hasPhone: !!phone}
    const ownerList = await dao.list('Shop', {columns: {userId}})
    const adminList = await dao.list('Staff', {columns: {userId, type: 1, status: 4}})
    ret['ownerList'] = ownerList.map((item) => item.id)
    if (['develop', 'trial'].includes(req.body.wxEnv)) { // 测试环境特殊处理，配合审核
      const testEnvAuditor = util.getConfig('album.testEnvAuditor')
      ret['ownerList'] = [...ret['ownerList'], ...testEnvAuditor]
      ret['hasPhone'] = true
    }
    ret['adminList'] = adminList.map((item) => item.shopId)
    ret['isSup'] = util.getConfig('album.superAdmin').includes(userId)
    ret['demoShops'] = util.getConfig('album.demoShops')
    let logs = viewLogs || '[]'
    logs = JSON.parse(logs)
    ret['viewLogs'] = logs
    cb(null, ret)
  } catch(e) {
    console.error(e)
    cb(e)
  }
}

module.exports.bindPhone = async (req, cb) => {
  try {
    const {appid, secret} = util.getConfig('album.appInfo')
    const { code, token } = req.body
    // 获取 access_tokenRes
    const access_token = await wxApi.getAccessToken({appid, secret})
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

module.exports.setViewLogs = async (req, cb) => {
  const {id: userId} = req.userInfo
  const {list} = req.body
  try {
    await dao.update('User', userId, {viewLogs: JSON.stringify(list)})
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.createOrder = async (req, cb) => {
  try {
    const {id: userId, openid} = req.userInfo
    const {level} = req.body
    const data = await pay.createOrder({userId, openid, shopInfo: req.shopInfo, level})
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.queryOrder = async (req, cb) => {
  try {
    const {id} = req.body
    const data = await pay.queryOrder(id, req.shopInfo)
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}