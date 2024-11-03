const path = require("path");
const express = require('express');
const router = express.Router();
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN}} = require(path.join(process.cwd(),"util/errCode"))

// 获取验证模块
const authorization = require(path.join(process.cwd(),"/modules/authorization"));

const userService = authorization.getService('userService')

router.post('/Login',
  async(req, res, next) => {
    userService.login(req.body, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/GetUserInfo',
  async(req, res, next) => {
    userService.getUserInfo(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

module.exports = router;