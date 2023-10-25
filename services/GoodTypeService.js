const path = require("path");
const _ = require('lodash')
const dao = require(path.join(process.cwd(),"dao/DAO"));

module.exports.getGoodTypes = (params ,cb) => {

  dao.list('GoodTypeModel', null, (err, models) => {
    cb(models)
  })
};

module.exports.modGoodType = (params, cb) => {
  const {id} = params
  if (id === -1) {
    // 创建

  } else {
    // 先看看 id 是否存在
    dao.findOne('GoodTypeModel', {id}, (err, data) => {
      console.log(data, 'data')
      cb(null)
    })
  }
  // dao.update(GoodTypeModel, )
}