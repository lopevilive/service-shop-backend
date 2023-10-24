const path = require("path");
const express = require('express');
const router = express.Router();

// 获取验证模块
const authorization = require(path.join(process.cwd(),"/modules/authorization"));

const goodTypeSrv = authorization.getService('GoodTypeService')

router.get('/GetGoodTypes',
  function(req, res, next) {
    next()
  },
  async (req, res, next) => {
    const ret = goodTypeSrv.getGoodTypes(1,
      (data) => {
        res.sendResult(data, 0, 'req ok hhh ')
      })(req,res, next)
  }
)

module.exports = router;