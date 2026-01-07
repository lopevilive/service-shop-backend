const path = require("path");
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN, CODE_LOGIN_ERR, CODE_PERMISSION_ERR}} = require(path.join(process.cwd(),"util/errCode"))
const ticketManage = require(path.join(process.cwd(),"modules/ticketManage"));
const dao = require(path.join(process.cwd(),"dao/DAO"));

/**
 * 1-需要登录
 * 1<<1 管理员
 */
const rulesMap = {
  oilService: {
    getOilInfo: {rid: 1},
    getUserInfo: {rid: 1},
    updateProv: {rid: 1}
  }
}

const executor = async (rule, req, res, serviceName, actionName) => {
  const {rid} = rule
  if (rid & 1) { // 需要登录
    const {headers: {authorization}} = req
    if (!authorization) return CODE_LOGIN_ERR
    try {
      const {status, rawStr} = ticketManage.verifyTicket(authorization)
      if (status !== 0) return CODE_LOGIN_ERR
      let userInfo = await dao.list('ZaUser', {columns: {openid: rawStr}})
      if (userInfo.length !== 1) {
        return CODE_LOGIN_ERR
      }
      req['userInfo'] = userInfo[0]
    } catch(e) {
      return CODE_LOGIN_ERR
    }
  }
  if (rid & 1<<1) { //管理员

  }
  return CODE_SUCC
}

module.exports.getRule = (serviceName, actionName) => {
  const tmpMap = rulesMap[serviceName]
  if (!tmpMap) return null
  const rule = tmpMap[actionName]
  return rule || null
}

module.exports.getRuleExecutor = (serviceName, actionName) => {
  return executor
}