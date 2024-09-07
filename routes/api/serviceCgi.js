const path = require("path");
const express = require('express');
const router = express.Router();
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN}} = require(path.join(process.cwd(),"util/errCode"))

// 获取验证模块
const authorization = require(path.join(process.cwd(),"/modules/authorization"));

const albumService = authorization.getService('albumService')

router.post('/ShopMod',
  async (req, res, next) => {
    albumService.shopMod(req.body,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      })(req,res, next)
  }
)

module.exports = router;