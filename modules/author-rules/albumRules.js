
const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));
const ticketManage = require(path.join(process.cwd(),"modules/ticketManage"));
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN, CODE_LOGIN_ERR, CODE_PERMISSION_ERR}} = require(path.join(process.cwd(),"util/errCode"))

// 是否登录
const useLogin = async (req) => {
  const {headers: {authorization}} = req
  if (!authorization) return false
  let openid
  try {
    const {status, rawStr} = ticketManage.verifyTicket(authorization)
    if (status !== 0) return false
    openid = rawStr
  } catch(e) {
    throw e
  }
  
  let userInfo = await dao.list('User', {columns: {openid}})
  if (userInfo.length !== 1) {
    return false
  }
  req['userInfo'] = userInfo[0]
  return true
}

// 是否有图册信息
const useShop = async (req, shopId) => {
  if (!shopId) {
    const {id} = req.userInfo
    const sups = util.getConfig('album.superAdmin')
    if (!sups.includes(id)) {
      throw new Error('缺少图册信息')
    } else {
      return
    }
    
  }
  let info = await dao.list('Shop', {columns: {id: shopId}})
  if (info.length !== 1) throw new Error('图册获取失败')
  req.shopInfo = info[0]
}

// 是否创建者
const useIsOwner = async (req) => {
  const {userInfo, shopInfo} = req
  const testEnvAuditor = util.getConfig('album.testEnvAuditor')
  if (testEnvAuditor.includes(shopInfo.id)) return true
  if ( +shopInfo.userId === userInfo.id) return true
  return false
}

// 是否管理员
const useIsAdmin = async (req) => {
  const {userInfo, shopInfo} = req
  const testEnvAuditor = util.getConfig('album.testEnvAuditor')
  if (testEnvAuditor.includes(shopInfo.id)) return true
  const res = await dao.list('Staff', {columns: {userId: userInfo.id,shopId: shopInfo.id, status: 4}})
  if (res.length) {
    return true
  }
  return false
}

const rulesMap = {
  albumService: {
    shopMod: {rid: 2, shopIdKey: 'id'},
    /**
     * rid:0-游客、1-需要登录、2-管理员或者创建者、3-创建者、10-需要手机认证、99-超级管理员
     * shopIdKey 图册id 的字段，默认 shopId
     */
    shopCreate: {rid: 10},
    productMod: {rid: 2},
    moveTopProduct: {rid: 2},
    productDel: {rid: 2},
    modProdTypesSort: {rid: 2},
    productTypesMod: {rid: 2},
    productTypesDel: {rid: 2},
    getCosTempKeys: {rid: 10},
    getStaff: {rid: 3},
    delStaff: {rid: 3},
    createStaff: {rid: 3},
    verfiyStaff: {rid: 10},
    acceptStaff: {rid: 10},
    getAllShop: {rid: 99},
    getAddressList: {rid: 1},
    addressMod: {rid: 1},
    addressDel: {rid: 1},
    createInventory: {rid: 1},
    getInventory: {rid: 1},
    modShopStatus: {rid: 2},
    encryAlbum: {rid: 2},
    getEncryCode: {rid: 2},
    updateEncryCode: {rid: 2},
    createFeedback: {rid: 2},
    saveWatermarkCfg: {rid: 2},
    auditingImg: {rid: 10},
    getCusInventory: {rid: 2},
    modInventoryStatus: {rid: 2},
    modProductPos: {rid: 2},
    getVipInfo: {rid: 2},
    textImgCheck: {rid: 1}
  },
  userService: {
    getUserInfo: {rid: 1},
    setViewLogs: {rid: 1},
    createOrder: {rid: 2},
    queryOrder: {rid: 2}
  }
}

const executor = async (rule, req, res, serviceName, actionName) => {
  let {rid, shopIdKey} = rule
  if (!shopIdKey) shopIdKey = 'shopId'
  const shopId = +req.body[shopIdKey]
  if (rid === 0) return CODE_SUCC
  let isLogin = false
  let isOwner = false
  let isAdmin = false

  isLogin = await useLogin(req)
  if (!isLogin) return CODE_LOGIN_ERR
  if (rid === 1) return CODE_SUCC
  const testEnvAuditor = util.getConfig('album.testEnvAuditor')
  if (testEnvAuditor.includes(shopId)) req.userInfo.phone = '123'
  const {id, phone} = req.userInfo
  if (rid === 10) {
    if (phone) return CODE_SUCC
    return CODE_PERMISSION_ERR
  }

  await useShop(req, shopId)

  const sups = util.getConfig('album.superAdmin')
  if (sups.includes(id)) return CODE_SUCC

  isOwner = await useIsOwner(req)
  isAdmin = await useIsAdmin(req)
  if (rid === 2) {
    if (!phone) return CODE_PERMISSION_ERR
    if (isOwner || isAdmin) return CODE_SUCC
    return CODE_PERMISSION_ERR
  }
  if (rid === 3) {
    if (!phone) return CODE_PERMISSION_ERR
    return isOwner ? CODE_SUCC : CODE_PERMISSION_ERR;
  }
    
  return CODE_PERMISSION_ERR
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
