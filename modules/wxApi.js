const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));
const ticketManage = require(path.join(process.cwd(),"modules/ticketManage"));
const axios = require('axios');

/**
 * 这里封装统一的微信相关的工具
 */

const getWxOpenid = async (code, appid, secret) => {
  try {
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

module.exports.getAccessToken = async (payload) => {
  const {appid, secret} = payload
  const access_tokenRes = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {params: {appid, secret, grant_type: 'client_credential'}})
  const {access_token, expires_in} = access_tokenRes.data
  console.log(expires_in, 'expires_in')
  return access_token;
}

const test = async () => {
  const {appid, secret} = util.getConfig('oil.appInfo')
  const access_token = await this.getAccessToken({appid, secret})
  // console.log(access_token)
  const res = await axios.post(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${access_token}`, {
    content: '中华',
    version: 2,
    scene: 4,
    openid: 'oMzuB110x8MXrjTynoDECQDrdWRk'
  })
  console.log(res.data)
}

// test()

module.exports.login = async (payload)=> {
  const {code, appid, secret, dbName} = payload
  const { openid } = await getWxOpenid(code, appid, secret)
  if (!openid) throw new Error('获取openid 失败')
  const res = await dao.list(dbName, {columns: {openid}})
  if (res.length === 0) { // 新用户，先创建
    await dao.create(dbName, {openid, add_time: util.getNowTime()})
  }
  const token = ticketManage.createTicket(openid, 60 * 60 * 24 * 180)
  return token
}

