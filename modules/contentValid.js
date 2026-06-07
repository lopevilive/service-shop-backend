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

/**
 * 校验文本
 * payload.content 要校验的文本
 * payload.type 1-需要记录、1<<1-不需要封禁
 * return {pass: true, msg: 'ok'} pass=true 说明正常、msg=违规提示语
 */
module.exports.albumValidText = async (payload) => {
  const {content, openid, userId, shopId = 0, type = 0} = payload || {}
  const {appid, secret} = util.getConfig('album.appInfo') || {};
  if (!content) return {pass: true, msg: ''}
  const env = util.getConfig('default.env')
  if (env === 'dev') return {pass: true, msg: ''} // 开发环境不校验
  try {
    let ret = await wxApi.msgSecCheck({content, appid, secret, openid})
    const logContent = JSON.stringify({ret, openid, appid, userId, shopId, text: content})
    util.secCheckCount(3) // 记录次数
    let recorded = false // 是否已经记录这条数据，避免重复记录
    if (type && (type & 1)) { // 需要记录数据
      recorded = true
      dao.create('XaCache', { dataType: 5, add_time: util.getNowTime(), content: logContent})
    }
    if (ret.suggest === 'pass') return {pass: true, msg: ''}
    if (ret.suggest === 'review') { // 需人工复审
      const msg = getMsg(ret.label)
      if (!recorded) {
        recorded = true
        dao.create('XaCache', { dataType: 5, add_time: util.getNowTime(), content: logContent})
      }

      if (!(type && (type & 1<<1))) {
        if (shopId) {
          dao.update('Shop', shopId, { auditing: 2}) // 标记图册
        }
      }
      return {pass: false, msg}
    }
    if (ret.suggest === 'risky') { // 有风险，这个时候直接封禁用户
      const msg = getMsg(ret.label)
      if (!recorded) {
        recorded = true
        dao.create('XaCache', { dataType: 6, add_time: util.getNowTime(), content: logContent})
      }
      if (!(type && (type & 1<<1))) {
        await dao.update('User', userId, {status: 1}) // 用户加入黑名单
        if (shopId) {
          await dao.update('Shop', shopId, {status: 1, auditing: 2}) // 封禁图册
        }
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

/**
 * 调微信审核接口
 * payload.type 1-不用删除记录、1<<1-不用封禁逻辑、1<<2-只接收微信回包，不用额外处理
 */
module.exports.albumWxSecCheck = async (payload) => {
  const {fileName, shopId, userId, openid, appid, secret, type = 0} = payload
  const {bucket, region} = cos.cfg
  const media_url = `https://${bucket}.cos.${region}.myqcloud.com/${fileName}?imageMogr2/quality/70/thumbnail/800x/strip`
  //cdn.xiaoguoyun.top/5_3_bd9a4e2d8ee1aab3ef91674d16720d5b.png?imageMogr2/quality/70/thumbnail/800x/strip
  try {
    const trace_id = await wxApi.mediaSecCheck({openid, appid, secret, media_url})
    // const trace_id = '6965ef8b-628096bc-2190c0ef'
    util.secCheckCount(2)
    const resContent = JSON.stringify({
      req: {media_url, shopId, userId, openid, appid},
      res: {}, // 微信的异步返回结果，此时还是空的
      type
    })
    dao.create('XaCache', {dataType: 10, add_time: util.getNowTime(), key1: trace_id, content: resContent})
  } catch(e) {
    const logContent = JSON.stringify({ errMsg: e.message || '未知错误', openid, appid, userId, shopId, media_url })
    dao.create('XaCache', {dataType: 9, add_time: util.getNowTime(), content: logContent})
  }
}



/**
 * 双重审核
 * 图册上传图片cos审核，同步接口
 * 返回 0 说明同步审核通过，1 不通过
 */
module.exports.albumValidImg = async (payload) => {
  const {fileName, shopId, userInfo} = payload
  const {appid, secret} = util.getConfig('album.appInfo')
  const testEnvAuditor = util.getConfig('album.testEnvAuditor')
  let type = 0;
  if (shopId && testEnvAuditor.includes(shopId)) {
    type = 1 | 1<<1
  }
  this.albumWxSecCheck({fileName, shopId, userId: userInfo.id, openid: userInfo.openid, appid, secret, type})

  const cosCheck = await albumIsNeedCosCheck(shopId)
  if (cosCheck === false) return 0
  const audRes = await cos.getImageAuditing(fileName)
  util.secCheckCount(1)
  const {RecognitionResult: {PornInfo}} = audRes
  const score = Number(PornInfo.Score)
  if (score <= 85) { // 85分以下不处理
    return 0
  }
  if (shopId) {
    await dao.update('Shop', shopId, { auditing: 2}) // 标记图册
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

// 视频截贞处理
const handleVideoCheck = async (transactionalEntityManager, content) => {
  try {
    const {req: {jobId, key}, res} = content
    const instance = await transactionalEntityManager.createQueryBuilder('XaCache', 'XaCache')
    instance.setLock('pessimistic_write')
    instance.where('XaCache.dataType = 16')
    instance.andWhere('XaCache.key2 = :jobId', {jobId})
    const data = await instance.getOne()
    if (!data) return
    const videoCheckContent = JSON.parse(data.content)
    const {taskList} = videoCheckContent
    let isPass = true // 判断视频是否已经通过审核
    for (const checkItem of taskList) {
      if (checkItem.key === key) {
        checkItem.checkRes = res
        checkItem.checkStatus = res.result.suggest
      }
      if (['pending', 'risky'].includes(checkItem.checkStatus)) isPass = false
    }
    await transactionalEntityManager.update('XaCache', {id: data.id}, {
      upd_time: util.getNowTime(), content: JSON.stringify(videoCheckContent)
    })
    if (isPass) { // 此处把记录标记为已通过，一般通过后会马上删除
      const { shopId } = videoCheckContent
      let shopInfo = await dao.list('shop', {columns: {id: shopId}})
      shopInfo = shopInfo[0]
      let needDel = true
      if (shopInfo.level === 0 || shopInfo.auditing === 2) { // 需要人工审核
        needDel = false
      }
      if (needDel) {
        await transactionalEntityManager.update('XaCache', {id: data.id}, {upd_time: util.getNowTime(), dataType: 21})
        await transactionalEntityManager.delete('XaCache', {id: data.id})
      }
      const keys = taskList.map((item) => item.key)
      cos.deleteMedia(keys) // 删除视频截贞
    }
  } catch(e) {
    console.log('update-err', e)
  }
  
}


// 微信异步返回结果后，读取db进行数据处理
module.exports.albumHandleWxMediaCheck = async () => {
  const manager = await dao.getManager()
  await manager.transaction(async (transactionalEntityManager) => {
    const instance = await transactionalEntityManager.createQueryBuilder('XaCache', 'XaCache');
    instance.setLock('pessimistic_write');
    instance.where('XaCache.dataType = 11')
    const data = await instance.getMany()
    for (const dataItem of data) {
      try {
        const content = JSON.parse(dataItem.content)
        // type 1-不用删除记录、1<<1-不用封禁逻辑、1<<2-只接收微信回包，不用额外处理、1<<3-视频截贞
        const {req: {userId, shopId}, res: {result, errcode}, type} = content
        if (errcode !== 0) continue
        if (type && (type & 1<<2)) continue // 这个状态用来过滤本地发起的审核，交由本地处理，此处跳过
        if (type && (type & 1<<3)) { // 视频截贞图片
          await handleVideoCheck(transactionalEntityManager, content)
        }
        if (result.suggest === 'pass') { // 无风险字段
          await transactionalEntityManager.update('XaCache', {id: dataItem.id}, {dataType: 12,upd_time: util.getNowTime()})
          if (!(type && (type & 1))) {
            await transactionalEntityManager.delete('XaCache', {id: dataItem.id}) //正常处理完删除，不保留
          }
        }
        if (result.suggest === 'review') { // 需要复查
          await transactionalEntityManager.update('XaCache', {id: dataItem.id}, {dataType: 13,upd_time: util.getNowTime()})
          if (!(type && (type & 1<<1))) {
            if (shopId) {
              await dao.update('Shop', shopId, { auditing: 2})
            }
          }
        }
        if (result.suggest === 'risky') { // 需要封禁图册
          await transactionalEntityManager.update('XaCache', {id: dataItem.id}, {dataType: 14,upd_time: util.getNowTime()})
          if (!(type && (type & 1<<1))) {
            await dao.update('User', userId, {status: 1}) // 用户加入黑名单
            if (shopId) {
              await dao.update('Shop', shopId, {status: 1, auditing: 2}) // 封禁画册
            }
          }
        }
      } catch(e) {
        console.error(e)
      }
    }
  })
}

// this.albumHandleWxMediaCheck()
