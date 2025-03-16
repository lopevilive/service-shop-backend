const path = require("path");
const express = require('express');
const router = express.Router();
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN}} = require(path.join(process.cwd(),"util/errCode"))

// 获取验证模块
const authorization = require(path.join(process.cwd(),"/modules/authorization"));

const userService = authorization.getService('userService')

router.post('/Login',
  (req, res, next) => {
    const {code} = req.body
    if (!code) {
      res.sendResult('null', CODE_PARAMS_ERR, '缺失 code')
      return
    }
    next()
  },
  async(req, res, next) => {
    userService.login(req, (err, data) => {
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


router.post('/BindPhone',
  (req, res, next) => {
    const {code, token} = req.body
    if (!code) {
      res.sendResult('null', CODE_PARAMS_ERR, '缺失 code')
      return
    }
    if (!token) {
      res.sendResult('null', CODE_PARAMS_ERR, '缺失 token')
      return
    }
    next()
  },
  async(req, res, next) => {
    userService.bindPhone(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)


router.post('/VeriToken',
  (req, res, next) => {
    const {token} = req.body
    if (!token) {
      res.sendResult('null', CODE_PARAMS_ERR, '缺失 token')
      return
    }
    next()
  },
  async(req, res, next) => {
    userService.veriToken(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/SetViewLogs',
  async(req, res, next) => {
    userService.setViewLogs(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)


module.exports = router;