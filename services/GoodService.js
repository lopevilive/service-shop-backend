const path = require("path");
const _ = require('lodash')
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))


module.exports.getGoods = ({typeId} ,cb) => {
  dao.list('GoodModel', {
    columns: {good_type: typeId, is_del: 0}
  }, (err, data) => {
    if (err) {
      cb('查询有误')
    } else {
      cb(null, data)
    }
  })
}

module.exports.modGood = () => {
  
}