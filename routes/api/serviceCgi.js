const path = require("path");
const express = require('express');
const router = express.Router();

// 获取验证模块
const authorization = require(path.join(process.cwd(),"/modules/authorization"));

const goodTypeSrv = authorization.getService('GoodTypeService')

router.get('/GetGoodTypes',
  async (req, res, next) => {
    goodTypeSrv.getGoodTypes(null,
      (data) => {
        res.sendResult(data, 0, 'req ok hhh ')
      })(req,res, next)
  }
)

router.post('/ModGoodType',
  (req, res, next) => {
    const {body} = req
    if (!body.type_name) {
      res.sendResult(null, 400, '参数有误')
      return
    } 
    next()
  },
  (req, res, next) => {
    goodTypeSrv.modGoodType(req.body,(ret) => {
      res.sendResult(null, 0, 'req ok hhh ')
    })(req, res, next)
    
  }
)

module.exports = router;