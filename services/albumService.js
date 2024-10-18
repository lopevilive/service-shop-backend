const path = require("path");
const _ = require('lodash')
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))
const cos = require(path.join(process.cwd(),"modules/cos"))

module.exports.getShop = (params ,cb) => {
  const {userId, shopId} = params
  let cond = {}
  if (userId) {
    cond = {columns: {userId}}
  }
  if (shopId) {
    cond = {columns: {id: shopId}}
  }
  cond.only = ['id', 'desc', 'logo', 'name']
  dao.list('Shop', cond, (err, data) => {
    if (err) return cb('查询有误')
    cb(null, data)
  })
}

module.exports.shopMod = (params ,cb) => {
  const {id} = params
  if (id === 0) {
    // 创建
    dao.create('Shop', {
      ...params,
      add_time: util.getNowTime()
    }, (err, data) => {
      if (err) return cb('创建失败')
      cb(null, data.id)
    })
    return
  }
  // 修改
  dao.update('Shop', id, {
    ...params,
    upd_time: util.getNowTime()
  }, (err, data) => {
    if (err) return cb('更新失败')
    cb(null, id)
  })
}

module.exports.productMod = async (params ,cb) => {
  const {id} = params
  if (id === 0) {
    // 创建
    dao.create('Product', {
      ...params,
      add_time: util.getNowTime()
    }, (err, data) => {
      if (err) return cb('创建失败')
      cb(null, data)
    })
    return
  }
  // 修改
  dao.update('Product', id, {
    ...params,
    upd_time: util.getNowTime()
  }, (err, data) => {
    if (err) return cb('更新失败')
    cb(null, {id})
  })
}

module.exports.getProduct = (params ,cb) => {
  const {shopId, productId, pageSize, currPage, productType} = params
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
  if (currPage > 0) {
    cond.skip = currPage * pageSize
  }
  if (pageSize > 0) {
    cond.take = pageSize
  }
  cond['columns'] = columns
  cond.only = ['id', 'desc', 'name', 'price', 'productType', 'shopId', 'url', 'type3D', 'model3D', 'modelUrl']
  cond.order = {sort: 'DESC', id: 'DESC'}
  dao.list('Product', cond, (err, data) => {
    if (err) return cb('查询有误')
    const ret = {list: data}
    ret.finished = data.length === pageSize ? false: true
    cb(null, ret)
  })
}

module.exports.moveTopProduct = async (params, cb) => {
  const {shopId, id} = params
  let sort = 0
  let res = await new Promise((resolve) => {
    dao.list('Product', {columns: {shopId}, order: {sort: 'DESC'}, take: 1}, (err, data) => {
      resolve(data)
    })
  })
  if (res.length === 1) {
    sort = res[0].sort + 1
  }
  dao.update('Product', id, {sort}, (err, data) => {
    if (err) return cb('调用失败')
    cb(null, data)
  })
}

module.exports.productDel = (params, cb) => {
  const {id} = params
  dao.delete('Product', id, cb)
}


module.exports.getProductTypes = (params ,cb) => {
  const {shopId} = params
  let  cond = {columns: {shopId}}

  cond.only = ['id', 'name', 'shopId']
  cond.order = {sort: 'DESC', id: 'ASC'}
  dao.list('ProductTypes', cond, (err, data) => {
    if (err) return cb('查询有误')
    cb(null, data)
  })
}

module.exports.moveTopProductType = async (params, cb) => {
  const {shopId, id} = params
  let sort = 0
  let res = await new Promise((resolve) => {
    dao.list('ProductTypes', {columns: {shopId}, order: {sort: 'DESC'}, take: 1}, (err, data) => {
      resolve(data)
    })
  })
  if (res.length === 1) {
    sort = res[0].sort + 1
  }
  dao.update('ProductTypes', id, {sort}, (err, data) => {
    if (err) return cb('调用失败')
    cb(null, data)
  })
}

module.exports.productTypesMod = (params ,cb) => {
  let {data: payload} = params
  let isMod = false
  for (const item of payload) {
    if (item.id) isMod = true
    item['add_time'] = util.getNowTime()
  }

  if (!isMod) { // 创建
    dao.create('ProductTypes', payload, (err, data) => {
      if (err) return cb('创建失败')
      cb(null, data)
    })
    return
  }

  // 修改
  payload = payload[0]
  dao.update('ProductTypes', payload.id, payload, (err, data) => {
    if (err) return cb('更新失败')
    cb(null, data)
  })
}

module.exports.productTypesDel = (params, cb) => {
  const {id} = params
  dao.delete('ProductTypes', id, cb)
}

module.exports.getCosTempKeys = async (req, cb) => {
  try {
    const data = await cos.getTempKeys()
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}
