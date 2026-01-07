const path = require("path");
const express = require('express');
const router = express.Router();
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN}} = require(path.join(process.cwd(),"util/errCode"))
const authorization = require(path.join(process.cwd(),"/modules/authorization")); // 获取验证模块

const oilService = authorization.getService('oilService')

router.post('/GetOilInfo', 
  async (req, res, next) => {
    oilService.getOilInfo(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)


router.post('/Login', 
  async (req, res, next) => {
    oilService.login(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/GetUserInfo', 
  async (req, res, next) => {
    oilService.getUserInfo(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/UpdateProv', 
  async (req, res, next) => {
    oilService.updateProv(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)



module.exports = router;