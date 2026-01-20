const path = require("path");
const express = require('express');
const router = express.Router();
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN}} = require(path.join(process.cwd(),"util/errCode"))

// 获取验证模块
const authorization = require(path.join(process.cwd(),"/modules/authorization"));

const albumService = authorization.getService('albumService')

router.post('/GetShop',
  async (req, res, next) => {
    albumService.getShop(req.body, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/ShopCreate',
  async (req, res, next) => {
    albumService.shopCreate(req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      })(req,res, next)
  }
)

router.post('/ShopMod',
  async (req, res, next) => {
    albumService.shopMod(req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      })(req,res, next)
  }
)

router.post('/ProductMod',
  async (req, res, next) => {
    albumService.productMod(req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      })(req,res, next)
  }
)

router.post('/MoveTopProduct',
  async (req, res, next) => {
    albumService.moveTopProduct(req.body, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/ProductDel',
  (req, res, next) => {
    const {id} = req.body
    if (!id) {
      res.sendResult('null', CODE_PARAMS_ERR, '参数有误')
      return
    }
    next()
  },
  async (req, res ,next) => {
    albumService.productDel(req.body, 
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      }
    )(req, res ,next)
  }
)

router.post('/GetProduct',
  (req, res, next) => {
    const {shopId, productId} = req.body
    if (!shopId && !productId) {
      res.sendResult('null', CODE_PARAMS_ERR, '参数有误')
      return
    }
    next()
  },
  async (req, res, next) => {
    albumService.getProduct(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/GetProductTypes',
  (req, res, next) => {
    const {shopId} = req.body
    if (!shopId) {
      res.sendResult('null', CODE_PARAMS_ERR, '参数有误')
      return
    }
    next()
  },
  async (req, res, next) => {
    albumService.getProductTypes(req.body, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)


router.post('/ProductTypesMod',
  async (req, res, next) => {
    albumService.productTypesMod(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/ModProdTypesSort',
  async (req, res, next) => {
    albumService.modProdTypesSort(req.body, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/ProductTypesDel',
  (req, res, next) => {
    const {id} = req.body
    if (!id) {
      res.sendResult('null', CODE_PARAMS_ERR, '参数有误')
      return
    }
    next()
  },
  async (req, res ,next) => {
    albumService.productTypesDel(req.body, 
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      }
    )(req, res ,next)
  }
)

router.post('/GetCosTempKeys',
  (req, res, next) => {
    albumService.getCosTempKeys(
      req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      }
    )(req, res, next)
  }
)


router.post('/GetStaff',
  (req, res, next) => {
    albumService.getStaff(
      req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      }
    )(req, res, next)
  }
)

router.post('/CreateStaff',
  (req, res, next) => {
    albumService.createStaff(
      req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      }
    )(req, res, next)
  }
)

router.post('/DelStaff',
  (req, res, next) => {
    albumService.delStaff(
      req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      }
    )(req, res, next)
  }
)

router.post('/VerfiyStaff',
  (req, res, next) => {
    albumService.verfiyStaff(
      req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      }
    )(req, res, next)
  }
)


router.post('/AcceptStaff',
  (req, res, next) => {
    albumService.acceptStaff(
      req,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult(data, CODE_SUCC, 'succ')
        }
      }
    )(req, res, next)
  }
)

router.post('/GetAllShop',
  async (req, res, next) => {
    albumService.getAllShop(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)


router.post('/GetAddressList',
  async (req, res, next) => {
    albumService.getAddressList(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/AddressMod',
  async (req, res, next) => {
    albumService.addressMod(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/AddressDel',
  async (req, res, next) => {
    albumService.addressDel(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/CreateInventory',
  async (req, res, next) => {
    albumService.createInventory(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/GetInventory',
  async (req, res, next) => {
    albumService.getInventory(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)


router.get('/ExportInventory1', // 弃用
  async (req, res, next) => {
    albumService.exportInventory(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.sendfile(data)
      }
    })(req, res, next)
  }
)

router.get('/ExportInventory',
  async (req, res, next) => {
    albumService.exportInventoryV2(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.redirect(302, data)
      }
    })(req, res, next)
  }
)


// 获取小程序码
router.post('/Getwxacodeunlimit',
  async (req, res, next) => {
    albumService.getwxacodeunlimit(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
        // res.send(data)
      }
    })(req, res, next)
  }
)


// 修改画册状态
router.post('/ModShopStatus',
  async (req, res, next) => {
    albumService.modShopStatus(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

// 画册加/解密
router.post('/EncryAlbum',
  async (req, res, next) => {
    albumService.encryAlbum(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/GetEncryCode',
  async (req, res, next) => {
    albumService.getEncryCode(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/UpdateEncryCode',
  async (req, res, next) => {
    albumService.updateEncryCode(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/ValiEncryCode',
  async (req, res, next) => {
    albumService.valiEncryCode(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/CreateFeedback',
  async (req, res, next) => {
    albumService.createFeedback(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/GetWatermarkCfg',
  async (req, res, next) => {
    albumService.getWatermarkCfg(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/SaveWatermarkCfg',
  async (req, res, next) => {
    albumService.saveWatermarkCfg(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/AuditingImg',
  async (req, res, next) => {
    albumService.auditingImg(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/GetCusInventory',
  async (req, res, next) => {
    albumService.getCusInventory(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/ModInventoryStatus',
  async (req, res, next) => {
    albumService.modInventoryStatus(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/ModProductPos',
  async (req, res, next) => {
    albumService.modProductPos(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/GetVipInfo',
  async (req, res, next) => {
    albumService.getVipInfo(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/Report',
  async (req, res, next) => {
    albumService.report(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.get('/WxMsgRec',
  async (req, res, next) => {
    albumService.wxMsgVerify(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.send(data)
      }
    })(req, res, next)
  }
)

router.post('/WxMsgRec',
  async (req, res, next) => {
    albumService.wxMsgRec(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.send('success')
      }
    })(req, res, next)
  }
)

router.post('/TextImgCheck',
  async (req, res, next) => {
    albumService.textImgCheck(req, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)




module.exports = router;