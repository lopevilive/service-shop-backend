const path = require("path");
const _ = require('lodash')
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))

module.exports.shopMod = (params ,cb) => {
  const {id, name, desc, logo} = params
  if (id === 0) {
    // 创建
    dao.create('ShopModel', {
      ...params,
      add_time: util.getNowTime()
    }, (err) => {
      if (err) return cb('创建失败')
      cb(null)
    })
    return
  }
  // 修改
  dao.update('ShopModel', id, {
    ...params,
    upd_time: util.getNowTime()
  }, (err) => {
    if (err) return cb('更新失败')
    cb(null)
  })
}
