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
    albumService.productMod(req.body,
      (err, data) => {
        if (err) {
          res.sendResult(null, CODE_UNKNOWN, err.message)
        } else {
          res.sendResult({id: data.id}, CODE_SUCC, 'succ')
        }
      })(req,res, next)
  }
)

router.post('/CountProduct',
  async (req, res, next) => {
    albumService.countProduct(req.body,
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
    albumService.getProduct(req.body, (err, data) => {
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
    albumService.productTypesMod(req.body, (err, data) => {
      if (err) {
        res.sendResult(null, CODE_UNKNOWN, err.message)
      } else {
        res.sendResult(data, CODE_SUCC, 'succ')
      }
    })(req, res, next)
  }
)

router.post('/MoveTopProductType',
  async (req, res, next) => {
    albumService.moveTopProductType(req.body, (err, data) => {
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

router.post(
  '/GetCosTempKeys',
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


router.post(
  '/GetStaff',
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

router.post(
  '/CreateStaff',
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

router.post(
  '/DelStaff',
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

router.post(
  '/VerfiyStaff',
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


router.post(
  '/AcceptStaff',
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

module.exports = router;