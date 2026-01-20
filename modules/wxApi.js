const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));
const ticketManage = require(path.join(process.cwd(),"modules/ticketManage"));
const axios = require('axios');

module.exports.labelCodeMap = [
  {label: 100, msg: '正常'}, {label: 10001, msg: '广告'}, {label: 20001, msg: '时政'}, {label: 20002, msg: '色情'},
  {label: 20003, msg: '辱骂'}, {label: 20006, msg: '违法犯罪'}, {label: 20008, msg: '欺诈'},{label: 20012, msg: '低俗'},
  {label: 20013, msg: '版权'}, {label: 21000, msg: '其他'}
]

/**
 * 这里封装统一的微信相关的工具
 */

const getWxOpenid = async (code, appid, secret) => {
  try {
    const reqPayload = {appid, secret, js_code: code, grant_type: 'authorization_code'}
    const {data} = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {params: reqPayload})
    return data
  } catch(e) {
    // console.log(`jscode2sessionErr:${e.message || e.msg}`)
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
  const manager = await dao.getManager()
  const env = util.getConfig('default.env')
  const ret = await manager.transaction(async (transactionalEntityManager) => {
    const instance = await transactionalEntityManager.createQueryBuilder('XaCache', 'XaCache');
    instance
      .setLock('pessimistic_write')
      .where('XaCache.dataType = 1')
      .andWhere('XaCache.key1 = :appid', {appid})
    const res = await instance.getOne()
    const nowTs = util.getNowTime()
    if (res) {
      const content = JSON.parse(res.content)
      const {access_token, expiredTs} = content
      if (nowTs <= (expiredTs - 60 * 30)) { // 提前30分钟过期
        return access_token
      }
      if (env === 'dev') return access_token
    }
    if (env === 'dev') return '' // 因为重复获取 access_token 会导致旧的 access_token 失效，这里避免影响生产环境的缓存
    // 下面重新获取 access_token
    const access_tokenRes = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {params: {appid, secret, grant_type: 'client_credential'}})
    const {access_token, expires_in} = access_tokenRes.data
    const content = {access_token, expiredTs: nowTs + expires_in}
    if (res) { // 修改
      await transactionalEntityManager.update('XaCache', {id: res.id}, {content: JSON.stringify(content), upd_time: nowTs})
    } else { // 新增
      await transactionalEntityManager.save('XaCache', {
        dataType: 1, content: JSON.stringify(content), key1: appid, add_time: nowTs
      })
    }
    return access_token
  })
  return ret
}

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

// 文本校验
module.exports.msgSecCheck = async (payload) => {
  // return { suggest: 'pass', label: 100 } // 防止校验接口崩溃影响业务
  const {appid, secret, content, openid, scene} = payload
  const access_token = await this.getAccessToken({appid, secret})
  const res = await axios.post(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${access_token}`, {
    content, version: 2, scene: scene || 1, openid
  })
  const {errcode, detail, result, errmsg} = res.data
  if (errcode !== 0) {
    throw new Error(`errcode:${errcode};errmsg:${errmsg || '校验出错'}`)
  }
  // return { suggest: 'review', label: 20012 }
  // return { suggest: 'risky', label: 20012 }
  return result
}

// 图片校验
module.exports.mediaSecCheck = async (payload) => {
  const {openid, appid, secret, scene = 1, media_url} = payload
  const access_token = await this.getAccessToken({appid, secret})
  const res = await axios.post(`https://api.weixin.qq.com/wxa/media_check_async?access_token=${access_token}`, {
    media_url, media_type: 2, version: 2, scene, openid
  })
  const {errcode, errmsg, trace_id} = res.data
  if (errcode !== 0) {
    throw new Error(`errcode:${errcode};errmsg:${errmsg || '校验出错'}`)
  }
  return trace_id
}

