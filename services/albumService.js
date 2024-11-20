const path = require("path");
const _ = require('lodash');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))
const cos = require(path.join(process.cwd(),"modules/cos"))
const {createTicket, verifyTicket} = require(path.join(process.cwd(),"modules/ticketManage"));
const { In } = require("typeorm");

module.exports.getShop = async (params ,cb) => {
  const {userId, shopId} = params
  let cond = {}
  if (userId) {
    cond = {columns: {userId}}
  }
  if (shopId) {
    if (Array.isArray(shopId)) {
      cond = {columns: {id: In(shopId)}}
    } else {
      cond = {columns: {id: shopId}}
    }
  }
  cond.only = ['id', 'desc', 'url', 'name', 'area', 'address', 'phone', 'qrcodeUrl', 'business']
  cond.take = 100 // 限制数量
  try {
    const data = await dao.list('Shop', cond)
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.shopCreate = async (req ,cb) => {
  const {userInfo} = req
  const params = {...req.body}
  try {
    const res = await dao.list('Shop', {columns: {userId: userInfo.id}})
    if (res.length) {
      throw new Error('每个用户暂时只能创建 1 个图册~')
    }
    const data = await dao.create('Shop', {...params, userId: userInfo.id, add_time: util.getNowTime()})
    cb(null, data.id)
  } catch(e) {
    cb(e)
  }
}

module.exports.shopMod = async (req ,cb) => {
  const params = {...req.body}
  const {id} = params
  try {
    await dao.update('Shop', id, {...params, upd_time: util.getNowTime()})
    cb(null, id)
  } catch(e) {
    cb(e)
  }
}

module.exports.productMod = async (req ,cb) => {
  const {shopInfo: {level}} = req
  const params = req.body
  const { id, shopId } = params

  if (id === 0) { // 创建
    try {
      let countRes = await dao.count('Product', {shopId})
      const count = countRes[0]['total']
      const vailRes = util.vailCount(level, count)
      if (!vailRes.pass) {
        // 超过限制数量
        cb(null, vailRes)
        return
      }

      const data = await dao.create('Product', {...params, add_time: util.getNowTime()})
      cb(null, data.id)
    } catch(e) {
      cb(e)
    }
  } else { // 修改
    let payload = { ...params, upd_time: util.getNowTime() }
    delete payload.id
    try {
      await dao.update('Product', id, payload)
      cb(null)
    } catch(e) {
      cb(e)
    }
  }
}

module.exports.getProduct = async (params ,cb) => {
  const {shopId, productId, pageSize, currPage, productType, status} = params
  let cond = {}
  const columns = {}
  if (shopId) {
    columns['shopId'] = shopId
  }
  if (productId) {
    if (Array.isArray(productId)) {
      columns['id'] = In(productId)
    } else {
      columns['id'] = productId
    }
  }
  if (productType) {
    columns['productType'] = productType
  }
  if (productType === -1) { // 取未分类的产品
    columns['productType'] = 0
  }
  if ([0,1].includes(status)) {
    columns['status'] = status
  }
  if (currPage > 0) {
    cond.skip = currPage * pageSize
  }
  if (pageSize > 0) {
    cond.take = pageSize
  }
  cond['columns'] = columns
  cond.only = ['id', 'desc', 'name', 'price', 'productType', 'shopId', 'url', 'type3D', 'model3D', 'modelUrl', 'status', 'fields', 'sort', 'attr']
  cond.order = {sort: 'DESC', id: 'DESC'}

  if (!cond.take) cond.take = 100 // 限制数量
  try {
    const data = await dao.list('Product', cond)
    const ret = {list: data}
    ret.finished = data.length === pageSize ? false: true
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.moveTopProduct = async (params, cb) => {
  const {shopId, id} = params
  let sort = 0
  try {
    let res = await dao.list('Product', {columns: {shopId}, order: {sort: 'DESC'}, take: 1})
    if (res.length === 1) {
      sort = res[0].sort + 1
    }
    const data = await dao.update('Product', id, {sort})
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.countProduct = async (params, cb) => {
  const {shopId} = params
  try {
    const data = await dao.count('Product', {shopId}, 'productType')
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.productDel = async (params, cb) => {
  const {id} = params
  try {
    await dao.delete('Product', id)
    cb(null)
  } catch(e) {
    cb(e)
  }
}


module.exports.getProductTypes = async (params ,cb) => {
  const {shopId} = params
  let  cond = {columns: {shopId}}

  cond.only = ['id', 'name', 'shopId']
  cond.order = {sort: 'DESC', id: 'ASC'}
  cond.take = 100 // 限制数量
  try {
    const data = await dao.list('ProductTypes', cond)
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.moveTopProductType = async (params, cb) => {
  const {shopId, id} = params
  let sort = 0
  try {
    let res = dao.list('ProductTypes', {columns: {shopId}, order: {sort: 'DESC'}, take: 1})
    if (res.length === 1) {
      sort = res[0].sort + 1
    }
    const data = dao.update('ProductTypes', id, {sort})
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.productTypesMod = async (params ,cb) => {
  let {data: payload} = params
  let isMod = false
  for (const item of payload) {
    if (item.id) { // 编辑
      isMod = true
      item['upd_time'] = util.getNowTime()
    } else { // 新增
      item['add_time'] = util.getNowTime()
    }
  }
  if (!isMod) { // 创建
    try {
      const data = await dao.create('ProductTypes', payload)
      cb(null, data)
    } catch(e) {
      cb(e)
    }
  } else { // 修改
    payload = payload[0]
    try {
      const data = await dao.update('ProductTypes', payload.id, payload)
      cb(null, data)
    } catch(e) {
      cb(e)
    }
  }
}

module.exports.productTypesDel = async (params, cb) => {
  const {id} = params
  try {
    await dao.delete('ProductTypes', id)
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.getCosTempKeys = async (req, cb) => {
  try {
    const data = await cos.getTempKeys()
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.getStaff = async (req, cb) => {
  const {shopInfo: {id: shopId}} = req
  const { type } = req.body
  try {
    const data = await dao.list('Staff', {
      columns: {type, shopId},
      only: ['id', 'nickName', 'type', 'phone', 'qrcodeUrl', 'shopId', 'status', 'ticket'],
      order: {status: 'ASC'},
      take: 100, // 限制数量
    })
    let needUpdate = []
    for (const item of data) {
      const { status, ticket, id } = item
      if (status === 1) { // 需要校验是否过了有效期
        const ticketRes = await verifyTicket(ticket)
        if (ticketRes.status !== 0) {
          item.status = 3
          needUpdate.push(id)
        }
      }
    }
    if (needUpdate.length) {
      await dao.update('Staff', needUpdate, {status: 3, upd_time: util.getNowTime()})
    }
    cb(null, data)
  } catch(e) {
    cb(e)
  } 
}

module.exports.createStaff = async (req, cb) => {
  const {shopInfo} = req
  const {nickName, type} = req.body

  try {
    const ticket = await createTicket('', 60 * 15) // 15 分钟有效
    const params = {
      shopId: shopInfo.id,
      nickName,
      type,
      status: 1,
      add_time: util.getNowTime(),
      ticket
    }
    const res = await dao.create('Staff', params)
    cb(null, res)
  } catch(e) {
    cb(e)
  }
}


module.exports.delStaff = async (req, cb) => {
  const {id} = req.body
  try {
    await dao.delete('Staff', id)
    cb(null)
  } catch(e) {
    cb(e)
  }
}


/**
 * @returns 
 * status: 0-验证通过、1-ticket过期、2-已失效、3-已经是管理员、4-创建者打开链接、5-获取不到信息
 */
module.exports.verfiyStaff = async (req, cb) => {
  const {id} = req.body
  const {userInfo} = req
  try {
    let res = await dao.list('Staff', {columns: {id}})
    if (res.length !== 1) {
      return cb(null, {status: 5})
    }
    res = res[0]
    const {ticket, status, shopId, type} = res
    if ([2,3,4].includes(status)) { // 这几种情况直接判定已失效
      return cb(null, {status: 2})
    }
    let admins = await dao.list('Staff', {columns: {shopId, userId: userInfo.id, type}})
    if (admins.length !== 0) return cb(null, {status: 3}) // 管理员打开了这个链接
    let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
    shopInfo = shopInfo[0]
    if (shopInfo.userId === userInfo.id) { // 创建者自己打开了这个链接
      return cb(null, {status: 4})
    }
    const ticketRes = await verifyTicket(ticket)
    if (ticketRes.status === -2) { // 过期
      return cb(null, {status: 1})
    }
    if (ticketRes.status === -1) {
      return cb(null, {status: 2})
    }
    if (ticketRes.status === 0) {
      return cb(null, {status: 0})
    }
    cb(null, {status: 2})
  } catch(e) {
    cb(e)
  }
}


module.exports.acceptStaff = async (req, cb) => {
  const {id} = req.body
  const {userInfo} = req
  try {
    let res = await dao.list('Staff', {columns: {id}})
    res = res[0]
    if (res.status !== 1) {
      throw new Error('未知错误')
    }
    await dao.update('Staff', id, {userId: userInfo.id, status: 4, upd_time: util.getNowTime()})
    cb(null)
  } catch(e) {
    cb(e)
  }
}
