const path = require("path");
const express = require('express');
const router = express.Router();
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN}} = require(path.join(process.cwd(),"util/errCode"))

// 获取验证模块
const authorization = require(path.join(process.cwd(),"/modules/authorization"));

// 商品分类模块
const goodTypeSrv = authorization.getService('GoodTypeService')

// 商品模块
const goodSrv = authorization.getService('GoodService')

router.post('/GetGoodTypes',
  async (req, res, next) => {
    goodTypeSrv.getGoodTypes(null,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      })(req,res, next)
  }
)

router.post('/ModGoodType',
  (req, res, next) => {
    const {body} = req
    if (!body.type_name) {
      res.sendResult(null, CODE_PARAMS_ERR, '参数有误')
      return
    } 
    next()
  },
  (req, res, next) => {
    goodTypeSrv.modGoodType(req.body,(err) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err)
      } else {
        res.sendResult(null, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)


router.post('/DelGoodType', 
  (req, res, next) => {
    const {body} = req
    if (!body.id) {
      res.sendResult(null, CODE_PARAMS_ERR, '参数有误')
      return
    } 
    next()
  },
  (req, res, next) => {
    goodTypeSrv.delGoodType(req.body, (err) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err)
      } else {
        res.sendResult(null, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)


router.post('/GetGoods',
  (req, res, next) => {
    const {body: {typeId}} = req
    if (!typeId) res.sendResult(null, CODE_PARAMS_ERR, '参数有误')
    else next()
  },
  (req, res, next) => {
    goodSrv.getGoods(req.body, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/ModGood',
  (req, res, next) => {
    // 参数校验 todo
    next()
  },
  (req, res, next) => {
    goodSrv.modGood(req.body, (err) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err)
      } else {
        res.sendResult(null, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

module.exports = router;