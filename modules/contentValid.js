const path = require("path");
const dao = require(path.join(process.cwd(),"dao/DAO"));
const wxApi = require(path.join(process.cwd(),"modules/wxApi"))
const util = require(path.join(process.cwd(),"util/index"))

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
 * return {pass: true, msg: 'ok'} pass=true 说明正常、msg=违规提示语
 */
module.exports.albumValidText = async (payload = {}) => {
  const {content, openid, userId, shopId = 0} = payload
  const {appid, secret} = util.getConfig('album.appInfo') || {};
  if (!content) return {pass: true, msg: ''}
  try {
    let ret = await wxApi.msgSecCheck({content, appid, secret, openid})
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
