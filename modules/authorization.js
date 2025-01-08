
const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));
const ticketManage = require(path.join(process.cwd(),"modules/ticketManage"));
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN, CODE_LOGIN_ERR, CODE_PERMISSION_ERR}} = require(path.join(process.cwd(),"util/errCode"))

global.service_caches = {};

// 存储全局验证函数
global.service_auth_fn = null;

/**
 * 构造回调对象格式
 * 
 * @param {[type]} serviceName   服务名称
 * @param {[type]} actionName    动作名称（方法名）
 * @param {[type]} serviceModule 服务模块
 * @param {[type]} origFunc      原始方法
 */
function Invocation(serviceName,actionName,serviceModule,origFunc) {
	return function() {
		var origArguments = arguments;
		return function(req,res,next) {
			if(global.service_auth_fn) {
				global.service_auth_fn(req,res,next,serviceName,actionName,function(pass) {
					if(pass) {
						origFunc.apply(serviceModule,origArguments);
					} else {
						res.sendResult(null,CODE_PERMISSION_ERR,"权限验证失败");
					}
				});
			} else {
				res.sendResult(null,CODE_PERMISSION_ERR,"权限验证失败");
			}
		}
	}
}

// 获取服务对象
module.exports.getService = function(serviceName) {

	if(global.service_caches[serviceName]) {
		return global.service_caches[serviceName];
	}

	var servicePath = path.join(process.cwd(),"services",serviceName);
	
	var serviceModule = require(servicePath);
	if(!serviceModule) {
		console.log("模块没有被发现");
		return null;
	}
	global.service_caches[serviceName] = {};

	for(actionName in serviceModule) {

		if(serviceModule && serviceModule[actionName] && typeof(serviceModule[actionName]) == "function") {
			var origFunc = serviceModule[actionName];
			global.service_caches[serviceName][actionName] = Invocation(serviceName,actionName,serviceModule,origFunc);
		}
	}
	// console.log(global.service_caches);
	return global.service_caches[serviceName];
}

// 设置全局验证函数
module.exports.setAuthFn = function(authFn) {
	global.service_auth_fn = authFn;
}

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
    const sups = util.getConfig('superAdmin')
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
  if ( +shopInfo.userId === userInfo.id) return true
  return false
}

// 是否管理员
const useIsAdmin = async (req) => {
  const {userInfo, shopInfo} = req
  const res = await dao.list('Staff', {columns: {userId: userInfo.id,shopId: shopInfo.id, status: 4}})
  if (res.length) {
    return true
  }
  return false
}

module.exports.execRule = async (rule, req, res, serviceName, actionName) => {
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
  const {id, phone} = req.userInfo
  if (rid === 10) {
    if (phone) return CODE_SUCC
    return CODE_PERMISSION_ERR
  }

  await useShop(req, shopId)

  const sups = util.getConfig('superAdmin')
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

module.exports.rules = {
  albumService: {
    shopMod: {rid: 2, shopIdKey: 'id'},
    /**
     * rid:0-游客、1-需要登录、2-管理员或者创建者、3-创建者、10-需要手机认证、99-超级管理员
     * shopIdKey 图册id 的字段，默认 shopId
     */
    shopCreate: {rid: 10},
    updateLevel: {rid: 99},
    productMod: {rid: 2},
    moveTopProduct: {rid: 2},
    productDel: {rid: 2},
    moveTopProductType: {rid: 2},
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
    getInventory: {rid: 1}
  },
  userService: {
    getUserInfo: {rid: 1}
  }
}

