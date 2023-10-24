const path = require("path");
const _ = require('lodash')
const dao = require(path.join(process.cwd(),"dao/DAO"));

module.exports.getGoodTypes = (params ,cb) => {

  dao.list('GoodTypeModel', null, (err, models) => {
    cb(models)
  })
//   cb ([
//     {
//         "name": "全部商品",
//         "id": 1
//     },
//     {
//         "name": "母鸡啊1",
//         "id": 2
//     },
//     {
//         "name": "母鸡2",
//         "id": 3
//     }
// ])
}