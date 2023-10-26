const path = require("path");
const _ = require('lodash')
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))


module.exports.getGoodTypes = (params ,cb) => {

  dao.list('GoodTypeModel', {
    columns: {
      is_del: 0
    }
  }, (err, models) => {
    if (err) {
      cb('查询有误')
    } else {
      cb(null, models)
    }
  })
};

module.exports.modGoodType = (params, cb) => {
  const {id, type_name} = params
  if (id === -1) {
    // 创建
    dao.create('GoodTypeModel', {
      type_name,
      add_time: util.getNowTime(),
      is_del: 0
    }, (err) => {
      if (err) {
        cb('创建失败')
      } else {
        cb(null)
      }
    })
  } else {
    dao.update('GoodTypeModel', id, {
      type_name,
      upd_time: util.getNowTime()
    }, (err, res) => {
      if (err) return cb('更新失败', false)
      cb(null)
    })
  }
}

module.exports.delGoodType = (params, cb) => {
  const {id} = params;
  dao.update('GoodTypeModel', id, {
    is_del: 1,
    delete_time: util.getNowTime()
  }, (err) => {
    if (err) return cb('更新失败', false)
      cb(null)
  })
}