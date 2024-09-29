const path = require("path");
const _ = require('lodash')
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))

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
  dao.list('ShopModel', cond, (err, data) => {
    if (err) return cb('查询有误')
    cb(null, data)
  })
}

module.exports.shopMod = (params ,cb) => {
  const {id} = params
  if (id === 0) {
    // 创建
    dao.create('ShopModel', {
      ...params,
      add_time: util.getNowTime()
    }, (err, data) => {
      if (err) return cb('创建失败')
      cb(null, data.id)
    })
    return
  }
  // 修改
  dao.update('ShopModel', id, {
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
    dao.create('ProductModel', {
      ...params,
      add_time: util.getNowTime()
    }, (err, data) => {
      if (err) return cb('创建失败')
      cb(null, data)
    })
    return
  }
  // 修改
  dao.update('ProductModel', id, {
    ...params,
    upd_time: util.getNowTime()
  }, (err, data) => {
    if (err) return cb('更新失败')
    cb(null, data)
  })
}

module.exports.getProduct = (params ,cb) => {
  const {shopId, productId} = params
  let cond = null
  if (shopId) {
    cond = {columns: {shopId}}
  }
  if (productId) {
    cond = {columns: {id: productId}}
  }
  cond.only = ['id', 'desc', 'imgs', 'name', 'price', 'productType', 'shopId', 'url', 'type3D', 'model3D', 'modelUrl']
  dao.list('ProductModel', cond, (err, data) => {
    if (err) return cb('查询有误')
    cb(null, data)
  })
}

module.exports.productDel = (params, cb) => {
  const {id} = params
  const sql = `delete from product where id = ${id}`
  dao.execSql(sql, cb)
}


module.exports.getProductTypes = (params ,cb) => {
  const {shopId} = params
  let  cond = {columns: {shopId}}

  cond.only = ['id', 'name', 'shopId']
  dao.list('ProductTypesModel', cond, (err, data) => {
    if (err) return cb('查询有误')
    cb(null, data)
  })
}

module.exports.productTypesMod = (params ,cb) => {
  const {id} = params
  if (id === 0) {
    // 创建
    dao.create('ProductTypesModel', {
      ...params,
      add_time: util.getNowTime()
    }, (err, data) => {
      if (err) return cb('创建失败')
      cb(null, data)
    })
    return
  }
  // 修改
  dao.update('ProductTypesModel', id, {
    ...params,
    upd_time: util.getNowTime()
  }, (err, data) => {
    if (err) return cb('更新失败')
    cb(null, data)
  })
}

module.exports.productTypesDel = (params, cb) => {
  const {id} = params
  const sql = `delete from product_types where id = ${id}`
  dao.execSql(sql, cb)
}
