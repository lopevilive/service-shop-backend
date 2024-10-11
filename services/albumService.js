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
    cb(null, data.id)
  })
}

module.exports.productMod = (params ,cb) => {
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
  cond.only = ['id', 'desc', 'imgs', 'name', 'price', 'productType', 'shopId', 'url', 'type3D', 'model3D', 'modelUrl']
  dao.list('Product', cond, (err, data) => {
    if (err) return cb('查询有误')
    const ret = {list: data}
    ret.finished = data.length === pageSize ? false: true
    cb(null, ret)
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
  dao.list('ProductTypes', cond, (err, data) => {
    if (err) return cb('查询有误')
    cb(null, data)
  })
}

module.exports.productTypesMod = (params ,cb) => {
  const {id} = params
  if (id === 0) {
    // 创建
    dao.create('ProductTypes', {
      ...params,
      add_time: util.getNowTime()
    }, (err, data) => {
      if (err) return cb('创建失败')
      cb(null, data)
    })
    return
  }
  // 修改
  dao.update('ProductTypes', id, {
    ...params,
    upd_time: util.getNowTime()
  }, (err, data) => {
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
