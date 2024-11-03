const path = require("path");
const _ = require('lodash')
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))
const cos = require(path.join(process.cwd(),"modules/cos"))

module.exports.getShop = async (params ,cb) => {
  const {userId, shopId} = params
  let cond = {}
  if (userId) {
    cond = {columns: {userId}}
  }
  if (shopId) {
    cond = {columns: {id: shopId}}
  }
  cond.only = ['id', 'desc', 'url', 'name', 'area', 'address', 'phone', 'qrcodeUrl', 'business']
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

module.exports.productMod = async (params ,cb) => {
  const {id} = params
  if (id === 0) { // 创建
    try {
      const data = await dao.create('Product', {...params, add_time: util.getNowTime()})
      cb(null, data)
    } catch(e) {
      cb(e)
    }
  } else { // 修改
    let payload = { ...params, upd_time: util.getNowTime() }
    delete payload.id
    try {
      await dao.update('Product', id, payload)
      cb(null, id)
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
    columns['id'] = productId
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
  cond.only = ['id', 'desc', 'name', 'price', 'productType', 'shopId', 'url', 'type3D', 'model3D', 'modelUrl', 'status']
  cond.order = {sort: 'DESC', id: 'DESC'}
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
