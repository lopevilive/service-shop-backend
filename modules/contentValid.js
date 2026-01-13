const path = require("path");
const dao = require(path.join(process.cwd(),"dao/DAO"));
const wxApi = require(path.join(process.cwd(),"modules/wxApi"))
const util = require(path.join(process.cwd(),"util/index"))
const cos = require(path.join(process.cwd(),"modules/cos"))

/**
 * 内容审核模块、包括文字、图片
 */


const getMsg = (label) => {
  if ([100, 21000, 20006, 20008, 20001, 20002].includes(label)) return '系统繁忙'
  if (label === 20013) return '请避免输入受版权保护的文字内容'
  const matchedItem = wxApi.labelCodeMap.find((item) => item.label === label)
  if (!matchedItem) return '系统繁忙~'
  return `请勿输入${matchedItem.msg}等文字内容~`
}

// 记录审核次数记录
const secCheckCount = async (logType) => {
  try {
    const manager = await dao.getManager()
    await manager.transaction(async (transactionalEntityManager) => {
      const instance = await transactionalEntityManager.createQueryBuilder('CusLogs', 'CusLogs');
      instance.setLock('pessimistic_write');
      instance.where('CusLogs.logType = :logType', {logType});
      const data = await instance.getOne()
      if (!data) {
        await transactionalEntityManager.save('CusLogs', { logType, add_time: util.getNowTime(), content: '1'})
      } else {
        const {id, content} = data
        let count = Number(content) + 1
        await transactionalEntityManager.update('CusLogs', {id}, {content: String(count), upd_time: util.getNowTime()})
      }
    })
  } catch(e) {
    console.log(e)
  }
}


/**
 * 校验文本
 * payload.content 要校验的文本
 * return {pass: true, msg: 'ok'} pass=true 说明正常、msg=违规提示语
 */
module.exports.albumValidText = async (payload = {}) => {
  const {content, openid, userId, shopId = 0} = payload
  const {appid, secret} = util.getConfig('album.appInfo') || {};
  if (!content) return {pass: true, msg: ''}
  try {
    let ret = await wxApi.msgSecCheck({content, appid, secret, openid})
    secCheckCount(3) // 记录次数
    if (ret.label === 100) return {pass: true, msg: ''}
    if (ret.suggest === 'pass') return {pass: true, msg: ''}
    const logContent = JSON.stringify({ret, openid, appid, userId, shopId, text: content})
    if (ret.suggest === 'review') { // 需人工复审
      const msg = getMsg(ret.label)
      dao.create('XaCache', { dataType: 5, add_time: util.getNowTime(), content: logContent})
      return {pass: false, msg}
    }
    if (ret.suggest === 'risky') { // 有风险，这个时候直接封禁用户
      const msg = getMsg(ret.label)
      dao.create('XaCache', { dataType: 6, add_time: util.getNowTime(), content: logContent})
      await dao.update('User', userId, {status: 1}) // 用户加入黑名单
      if (shopId) {
        await dao.update('Shop', shopId, {status: 1, auditing: 2}) // 封禁图册
      }
      return {pass: false, msg}
    }

    return {pass: false, msg: '系统繁忙，稍后重试'} //兜底
  } catch(e) { // 这里记录一下校验 失败原因
    const logContent = JSON.stringify({ errMsg: e.message || '未知错误', openid, appid, userId, shopId, text: content })
    dao.create('XaCache', { dataType: 4, add_time: util.getNowTime(), content: logContent})
    return {pass: false, msg: '系统繁忙，稍后重试～'}
  }
  
}

// 判断是否需要 cos 审核
const albumIsNeedCosCheck = async (shopId) => {
  if (!shopId) return true
  let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
  if (!shopInfo || !shopInfo.length) return true
  const {auditing} = shopInfo[0]
  if (auditing === 99) return false
  if (auditing === 0) {
    dao.update('Shop', shopId, {auditing: 1})
  }
  return true
}

// 调微信审核接口
const albumWxSecCheck = async (payload) => {
  const {fileName, shopId, userId, openid, appid, secret} = payload
  const {bucket, region} = cos.cfg
  const media_url = `https://${bucket}.cos.${region}.myqcloud.com/${fileName}?imageMogr2/quality/40`
  try {
    const trace_id = await wxApi.mediaSecCheck({openid, appid, secret, media_url})
    // const trace_id = '6965ef8b-628096bc-2190c0ef'
    secCheckCount(2)
    const resContent = JSON.stringify({
      req: {media_url, shopId, userId, openid, appid},
      res: {} // 微信的异步返回结果，此时还是空的
    })
    dao.create('XaCache', {dataType: 10, add_time: util.getNowTime(), key1: trace_id, content: resContent})
  } catch(e) {
    const logContent = JSON.stringify({ errMsg: e.message || '未知错误', openid, appid, userId, shopId, media_url })
    dao.create('XaCache', {dataType: 9, add_time: util.getNowTime(), content: logContent})
  }
}



/**
 * 
 * 图册上传图片审核。双重审核：cos 接口同步审核、小程序官方接口异步审核
 * 返回 0 说明同步审核通过，1 不通过
 */
module.exports.albumValidImg = async (payload) => {
  const {fileName, shopId, userInfo} = payload
  const {appid, secret} = util.getConfig('album.appInfo')
  albumWxSecCheck({fileName, shopId, userId: userInfo.id, openid: userInfo.openid, appid, secret})

  const cosCheck = await albumIsNeedCosCheck(shopId)
  if (cosCheck === false) return 0
  const audRes = await cos.getImageAuditing(fileName)
  secCheckCount(1)
  const {RecognitionResult: {PornInfo}} = audRes
  const score = Number(PornInfo.Score)
  if (score <= 85) { // 85分以下不处理
    return 0
  }
  const riskyScort = 98
  const logContent = JSON.stringify({ audRes, appid, userId: userInfo.id, openid: userInfo.openid, shopId})
  dao.create('XaCache', {dataType: score >= riskyScort ? 8 : 7, add_time: util.getNowTime(), content: logContent})
  if (score >= riskyScort) { // 这个时候要封禁用户和图册并且记录审核结果
    await dao.update('User', userInfo.id, {status: 1}) // 用户加入黑名单
    if (shopId) {
      await dao.update('Shop', shopId, {status: 1, auditing: 2}) // 封禁画册
    }
    return 1
  } else {
    return 0
  }
}
