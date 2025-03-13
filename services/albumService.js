const path = require("path");
const _ = require('lodash');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))
const cos = require(path.join(process.cwd(),"modules/cos"))
const {createTicket, verifyTicket} = require(path.join(process.cwd(),"modules/ticketManage"));
const { In, Like } = require("typeorm");
const axios = require('axios');
const ExcelJS = require('exceljs/dist/es5');
const dayjs = require('dayjs')
const crypto = require('crypto');
const fs = require('fs');
// const toolsScript = require(path.join(process.cwd(),"/services/toolsScript.js"))

module.exports.getShop = async (params ,cb) => {
  const {userId, shopId} = params
  let cond = {}
  if (userId) {
    cond.columns = {userId}
  }
  if (shopId) {
    if (Array.isArray(shopId)) {
      cond.columns = {id: In(shopId)}
    } else {
      cond.columns = {id: shopId}
    }
  }
  cond.only = [
    'id', 'desc', 'url', 'name', 'area', 'address', 'phone', 'qrcodeUrl', 'business',
    'attrs', 'specCfg', 'level', 'status', 'encry', 'waterMark', 'auditing']
  cond.take = 100 // 限制数量
  try {
    const data = await dao.list('Shop', cond)
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.shopCreate = async (req ,cb) => {
  const {userInfo} = req
  const params = {...req.body}
  try {
    if (userInfo.status === 1) { // 违规用户
      throw new Error('请稍后重试*')
    }
    const sups = util.getConfig('superAdmin')
    if (!sups.includes(userInfo.id)) {
      const res = await dao.list('Shop', {columns: {userId: userInfo.id}})
      if (res.length) {
        throw new Error('每个用户暂时只能创建 1 个图册~')
      }
    }
    const data = await dao.create('Shop', {...params, userId: userInfo.id, add_time: util.getNowTime()})
    cb(null, data.id)
  } catch(e) {
    cb(e)
  }
}

module.exports.shopMod = async (req ,cb) => {
  const params = {...req.body, upd_time: util.getNowTime()}
  const {id} = params
  delete params.level
  delete params.status
  delete params.encry
  delete params.waterMark
  delete params.auditing
  try {
    await dao.update('Shop', id, params)
    cb(null, id)
  } catch(e) {
    cb(e)
  }
}

module.exports.updateLevel = async (req, cb) => {
  const params = req.body
  const {shopId, level, expiredTime} = params
  try {
    await dao.update('Shop', shopId, {level, expiredTime})
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.productMod = async (req ,cb) => {
  const {shopInfo: {level, status}} = req
  const params = req.body
  const { id, shopId } = params

  if (status === 1) {
    cb(new Error('未知错误，请重启小程序*'))
    return
  }

  if (id === 0) { // 创建
    try {
      let countRes = await dao.count('Product', {shopId})
      const count = countRes[0]['total']
      const vailRes = util.vailCount(level, count)
      if (!vailRes.pass) {
        // 超过限制数量
        cb(null, vailRes)
        return
      }

      const data = await dao.create('Product', {...params, add_time: util.getNowTime()})
      cb(null, data.id)
    } catch(e) {
      cb(e)
    }
  } else { // 修改
    let payload = { ...params, upd_time: util.getNowTime() }
    delete payload.id // 批量操作时，需要删除 id
    try {
      await dao.update('Product', id, payload)
      cb(null)
    } catch(e) {
      cb(e)
    }
  }
}

module.exports.getProduct = async (req ,cb) => {
  const params = req.body
  const {
    shopId, productId, pageSize, currPage, productType, status, searchStr, priceSort
  } = params

  try {
    let total = 0
    let limit = 0
    let unCateNum = 0;
    let downNum = 0;
    const queryBuild = await dao.createQueryBuilder('Product')
    queryBuild.select([
      'Product.id', 'Product.desc', 'Product.name', 'Product.price', 'Product.productType', 'Product.shopId',
      'Product.url', 'Product.type3D', 'Product.model3D', 'Product.modelUrl', 'Product.status', 'Product.fields',
      'Product.sort', 'Product.attr', 'Product.isSpec', 'Product.specs', 'Product.upd_time',
    ])
    queryBuild.where('1 = 1')
    if (shopId) queryBuild.andWhere('Product.shopId = :shopId', {shopId})
    if (productId) {
      let ids = productId
      if (!Array.isArray(productId)) ids = [productId]
      queryBuild.andWhere('Product.id IN (:...ids)', {ids})
    }
    if (productType) queryBuild.andWhere('Product.productType = :productType', {productType})
    if (productType === -1) queryBuild.andWhere('Product.productType = :productType', {productType: ''})
    if ([0,1].includes(status)) queryBuild.andWhere('Product.status = :status', {status})
    if (searchStr) queryBuild.andWhere('Product.desc LIKE :searchStr', {searchStr: `%${searchStr}%`})
    const sizeLimit = pageSize || 100;
    queryBuild.limit(sizeLimit)
    if (currPage > 0) queryBuild.offset(currPage * sizeLimit)
    if (priceSort === 1) {
      queryBuild.orderBy('CAST(Product.price AS DECIMAL(10,2))', 'ASC')
    }
    if (priceSort === 2) {
      queryBuild.orderBy('CAST(Product.price AS DECIMAL(10,2))', 'DESC')
    }
    if ([1,2].includes(priceSort)) {
      queryBuild.addOrderBy('Product.sort', 'DESC')
    } else {
      queryBuild.orderBy('Product.sort', 'DESC')
    }
    queryBuild.addOrderBy('Product.id', 'DESC')
    
    const data = await queryBuild.getMany()

    if (shopId) {
      let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
      shopInfo = shopInfo[0]
      const countRes = await dao.count('Product', {shopId, status: 0}, 'productType')
      for (const item of countRes) {
        total += Number(item.total)
        if (!item.productType) {
          unCateNum += Number(item.total)
        }
      }
      const downNumRes = await dao.count('Product', {shopId, status: 1})
      if (downNumRes && downNumRes[0] && downNumRes[0].total) {
        downNum = Number(downNumRes[0].total);
        total += downNum;
      }
      let vailRes = util.vailCount(shopInfo.level, total)
      limit = vailRes.limit
    }

    const ret = {list: data, total, limit, unCateNum, downNum}
    ret.finished = data.length === sizeLimit ? false: true
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.moveTopProduct = async (params, cb) => {
  const {shopId, id} = params
  let sort = 0
  try {
    let res = await dao.list('Product', {columns: {shopId}, order: {sort: 'DESC'}, take: 1})
    if (res.length === 1) {
      sort = res[0].sort + 1
    }
    const data = await dao.update('Product', id, {sort})
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.countProduct = async (params, cb) => {
  const {shopId} = params
  try {
    const data = await dao.count('Product', {shopId}, 'productType')
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.productDel = async (params, cb) => {
  const {id} = params
  try {
    await dao.delete('Product', id)
    cb(null)
  } catch(e) {
    cb(e)
  }
}


module.exports.getProductTypes = async (params ,cb) => {
  const {shopId} = params
  let  cond = {columns: {shopId}}

  cond.only = ['id', 'name', 'shopId']
  cond.order = {sort: 'DESC', id: 'ASC'}
  cond.take = 100 // 限制数量
  try {
    const data = await dao.list('ProductTypes', cond)
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.moveTopProductType = async (params, cb) => {
  const {shopId, id} = params
  let sort = 0
  try {
    let res = await dao.list('ProductTypes', {columns: {shopId}, order: {sort: 'DESC'}, take: 1})
    if (res.length === 1) {
      sort = res[0].sort + 1
    }
    const data = await dao.update('ProductTypes', id, {sort})
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.productTypesMod = async (params ,cb) => {
  let {data: payload} = params
  let isMod = false
  for (const item of payload) {
    if (item.id) { // 编辑
      isMod = true
      item['upd_time'] = util.getNowTime()
    } else { // 新增
      item['add_time'] = util.getNowTime()
    }
  }
  if (!isMod) { // 创建
    try {
      const data = await dao.create('ProductTypes', payload)
      cb(null, data)
    } catch(e) {
      cb(e)
    }
  } else { // 修改
    payload = payload[0]
    try {
      const data = await dao.update('ProductTypes', payload.id, payload)
      cb(null, data)
    } catch(e) {
      cb(e)
    }
  }
}

module.exports.productTypesDel = async (params, cb) => {
  let {id} = params
  try {
    await dao.delete('ProductTypes', id)
    if (!Array.isArray(id)) {
      id = [id]
    }
    let list = await dao.list('Product', {columns: {productType: In(id)}})
    if (list.length) {
      list = list.map((item) => item.id)
      await dao.update('Product', list, {'productType': ''})
    }
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.getCosTempKeys = async (req, cb) => {
  try {
    const { userInfo: {status} } = req
    if (status === 1) { // 违规用户
      throw new Error('请稍后重试*')
    }
    const data = await cos.getTempKeys()
    cb(null, data)
  } catch(e) {
    cb(e)
  }
}

module.exports.getStaff = async (req, cb) => {
  const {shopInfo: {id: shopId}} = req
  const { type } = req.body
  try {
    const data = await dao.list('Staff', {
      columns: {type, shopId},
      only: ['id', 'nickName', 'type', 'phone', 'qrcodeUrl', 'shopId', 'status', 'ticket'],
      order: {status: 'ASC'},
      take: 100, // 限制数量
    })
    let needUpdate = []
    for (const item of data) {
      const { status, ticket, id } = item
      if (status === 1) { // 需要校验是否过了有效期
        const ticketRes = verifyTicket(ticket)
        if (ticketRes.status !== 0) {
          item.status = 3
          needUpdate.push(id)
        }
      }
    }
    if (needUpdate.length) {
      await dao.update('Staff', needUpdate, {status: 3, upd_time: util.getNowTime()})
    }
    cb(null, data)
  } catch(e) {
    cb(e)
  } 
}

module.exports.createStaff = async (req, cb) => {
  const {shopInfo} = req
  const {nickName, type} = req.body

  try {
    const ticket = createTicket('createStaff', 60 * 60 * 4) //4小时内有效
    const params = {
      shopId: shopInfo.id,
      nickName,
      type,
      status: 1,
      add_time: util.getNowTime(),
      ticket
    }
    const res = await dao.create('Staff', params)
    cb(null, res)
  } catch(e) {
    cb(e)
  }
}


module.exports.delStaff = async (req, cb) => {
  const {id} = req.body
  try {
    await dao.delete('Staff', id)
    cb(null)
  } catch(e) {
    cb(e)
  }
}


/**
 * @returns 
 * status: 0-验证通过、1-ticket过期、2-已失效、3-已经是管理员、4-创建者打开链接、5-获取不到信息
 */
module.exports.verfiyStaff = async (req, cb) => {
  const {id} = req.body
  const {userInfo} = req
  try {
    let res = await dao.list('Staff', {columns: {id}})
    if (res.length !== 1) {
      return cb(null, {status: 5})
    }
    res = res[0]
    const {ticket, status, shopId, type} = res
    if ([2,3,4].includes(status)) { // 这几种情况直接判定已失效
      return cb(null, {status: 2})
    }
    let admins = await dao.list('Staff', {columns: {shopId, userId: userInfo.id, type}})
    if (admins.length !== 0) return cb(null, {status: 3}) // 管理员打开了这个链接
    let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
    shopInfo = shopInfo[0]
    if (shopInfo.userId === userInfo.id) { // 创建者自己打开了这个链接
      return cb(null, {status: 4})
    }
    const ticketRes = verifyTicket(ticket)
    if (ticketRes.status === -2) { // 过期
      return cb(null, {status: 1})
    }
    if (ticketRes.status === -1) {
      return cb(null, {status: 2})
    }
    if (ticketRes.status === 0) {
      return cb(null, {status: 0})
    }
    cb(null, {status: 2})
  } catch(e) {
    cb(e)
  }
}


module.exports.acceptStaff = async (req, cb) => {
  const {id} = req.body
  const {userInfo} = req
  try {
    let res = await dao.list('Staff', {columns: {id}})
    res = res[0]
    if (res.status !== 1) {
      throw new Error('未知错误')
    }
    // 严格来说这里应该加锁
    await dao.update('Staff', id, {userId: userInfo.id, status: 4, upd_time: util.getNowTime()})
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.getAllShop = async (req, cb) => {
  const { currPage, pageSize, str, shopId, status, auditing } = req.body
  const columns = {}
  if (str) columns.name = Like(`%${str}%`)
  if (util.isIntegerString(shopId)) {
    columns.id = Number(shopId)
  }
  if (util.isIntegerString(status)) {
    columns.status = Number(status)
  }
  if (util.isIntegerString(auditing))  {
    columns.auditing = Number(auditing)
  }
  const cond = {
    skip: currPage * pageSize,
    take: pageSize,
    order: {id: 'DESC'},
    columns
  }
  try {
    const data = await dao.list('Shop', cond)
    const ret = {list: data}
    ret.finished = data.length === pageSize ? false: true
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}


module.exports.getAddressList = async (req, cb) => {
  const {userInfo: {id: userId}} = req
  try {
    const ret = await dao.list('Address', {
      columns: {userId},
      order: {isDefault: 'DESC'}
    })
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.addressMod = async (req, cb) => {
  const {userInfo: {id: userId}} = req
  const params = {...req.body}
  params.isDefault = params.isDefault ? 1 : 0
  try {
    if (params.isDefault === 1) {
      const list = await dao.list('Address', {columns: {userId, isDefault: 1}})
      let needResetList = []
      for (const item of list) {
        if (item.id === params.id) continue
        needResetList.push(item.id)
      }
      if (needResetList.length) { // 把其他默认地址重置
        await dao.update('Address', needResetList, {isDefault: 0})
      }
    }

    if (!params.id) { // 新增
      params.add_time = util.getNowTime()
      params.userId = userId
      const ret = await dao.create('Address', {...params})
      cb(null, ret.id)
    } else { // 编辑
      params.upd_time = util.getNowTime()
      await dao.update('Address', params.id, params)
      cb(null)
    }
    
  } catch(e) {
    cb(e)
  }
}

module.exports.addressDel = async (req, cb) => {
  try {
    const {id} = req.body
    await dao.delete('Address', id)
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.createInventory = async (req, cb) => {
  try {
    const {userInfo, body} = req
    let params = {
      userId: userInfo.id,
      shopId: +body.shopId,
      add_time: util.getNowTime(),
      data: body.data,
      type: body.type
    }
    const ret = await dao.create('Enventory', params)
    cb(null, ret.id)
  } catch(e) {
    cb(e)
  }
}

module.exports.getInventory = async (req, cb) => {
  const {id, userId, shopId, limit, type} = req.body
  const columns = {type: 0}
  if (type) columns.type = type
  if (id) {
    columns.id =  id
  }
  if (userId) {
    columns.userId = userId
  }
  if (shopId) {
    columns.shopId = shopId
  }
  if (!id && !userId) {
    cb(new Error('参数有误'))
    return
  }
  const take = limit ? limit : 5
  try {
    const ret = await dao.list('Enventory', {columns, take, order: {id: 'DESC'}})
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.exportInventory = async (req, cb) => {
  const {id} = req.query
  if (!id) {
    cb(new Error('参数有误'))
    return
  }
  try {
    let info = await dao.list('Enventory', {columns: {id}})
    info = info[0]
    let data = JSON.parse(info.data)
    let list = data.list
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('报价清单', {views:[{state: 'frozen', xSplit: 0, ySplit:1}]});
    sheet.columns = [
      {header: '序号', key: 'idx', width: 5},
      {header: '图片', key: 'url', width: 10},
      {header: '产品描述', key: 'desc', width: 20},
      {header: '规格', key: 'spec', width: 10},
      {header: '数量', key: 'count', width: 8},
      {header: '单价', key: 'price', width: 8},
    ];
    await util.loadImg(list)
    sheet.getRow(1).height = 42.5
    sheet.getRow(1).eachCell({includeEmpty: false}, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFdddbb0'} }
      cell.font = {size: 16, bold: true}
      cell.alignment = {vertical: 'middle', horizontal: 'center'}
    })
    let idx = 1
    for (const item of list) {
      idx += 1
      sheet.addRow({idx: idx - 1, url: '', desc: item.desc, spec: item.spec, count: item.count, price: item.price})
      sheet.getRow(idx).height = 42.5
      sheet.getRow(idx).eachCell({includeEmpty: false}, (cell, i) => {
        cell.alignment = {vertical: 'middle'}
        if ([1,5,6].includes(i)) {
          cell.alignment = {vertical: 'middle', horizontal: 'center'}
        }
      })
      if (!item.img) continue
      const imageId = workbook.addImage({ buffer: item.img, extension: 'jpeg'});
      sheet.addImage(imageId, { tl: { col: 1, row: idx - 1 }, ext: { width: 50, height: 50 }});
    }
    idx += 1
    sheet.addRow([`总价格： ${data.totalPrice}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
      cell.font = {size: 15, bold: true}
    })

    idx += 1
    sheet.addRow([`总数量： ${data.totalCount}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
      cell.font = {size: 15, bold: true}
    })

    idx += 1
    sheet.addRow([`备注： ${data.remark}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
      cell.font = {size: 15, bold: true}
    })

    idx += 1
    sheet.addRow([`收货地址： ${data.address}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
      cell.font = {size: 15, bold: true}
    })

    idx += 1
    sheet.addRow([`创建时间： ${dayjs(info.add_time * 1000).format('YYYY/MM/DD HH:mm')}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
    })

    const md5 = crypto.createHash('md5').update(`${id}-${util.getNowTime()}`).digest('hex')
    const env = util.getConfig('env')
    let fileName = `/tmp/报价单-${md5}.xlsx`
    if (env === 'dev') {
      fileName = path.join(process.cwd(),`tmp/报价单-${md5}.xlsx`)
    }
    
    await workbook.xlsx.writeFile(fileName)
    setTimeout(() => {
      fs.unlink(fileName, (err) => {
        console.error(err)
      })
    }, 10000);
    cb(null, fileName)
  } catch (e) {
    cb(e)
  }
}

module.exports.getwxacodeunlimit = async (req, cb) => {
  try {
    const {appid, secret} = util.getConfig('appInfo');
    const {scene} = req.body;

    // 获取 access_token
    const access_tokenRes = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {params: {appid, secret, grant_type: 'client_credential'}})
    const {access_token, expires_in} = access_tokenRes.data
    let url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${access_token}`
    const {data} = await axios.post(url, { scene, is_hyaline: true }, { responseType: 'arraybuffer'})
    const base64 = data.toString('base64')
    if (base64.length < 5000) {
      // 不是图片
      throw new Error('获取小程序二维码失败')
    }
    cb(null, base64)
  }catch(e) {
    cb(e)
  }
}

module.exports.modShopStatus = async (req, cb) => {
  try {
    const {shopId, status, auditing} = req.body
    const payload = {status, auditing, upd_time: util.getNowTime()}
    await dao.update('Shop', shopId, payload)
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.encryAlbum = async (req, cb) => {
  try {
    const {shopId, encry} = req.body
    let payload = { encry }
    let encryCode = 0
    if (encry === 1) {
      let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
      shopInfo = shopInfo[0]
      encryCode = shopInfo.encryCode
      if (encryCode === 0) {
        encryCode = util.rand(1000, 9999)
        payload.encryCode = encryCode
      }
    }
    await dao.update('Shop', shopId, payload)
    cb(null, encryCode)
  } catch(e) {
    cb(e)
  }
}

module.exports.getEncryCode = async (req, cb) => {
  try {
    const {shopId} = req.body
    let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
    shopInfo = shopInfo[0]
    cb(null, shopInfo.encryCode)
  } catch(e) {
    cb(e)
  }
}

module.exports.updateEncryCode = async (req, cb) => {
  try {
    const {shopId} = req.body
    let encryCode = util.rand(1000, 9999)
    await dao.update('Shop', shopId, {encryCode})
    cb(null, encryCode)
  } catch(e) {

  }
}

module.exports.valiEncryCode = async (req, cb) => {
  const { shopId, passStr } = req.body
  if (!shopId) {
    cb(new Error('缺少参数'))
    return
  }
  try {
    let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
    shopInfo = shopInfo[0]
    let encryCode = shopInfo.encryCode
    if (String(encryCode) === String(passStr)) {
      cb(null, true)
    } else {
      cb(null, false)
    }
  } catch(e) {
    cb(e)
  }
}

module.exports.createFeedback = async (req, cb) => {
  const { userInfo: {id}, body } = req
  const params = {
    ...body,
    userId: id,
    add_time: util.getNowTime()
  }
  try {
    const ret = await dao.create('Feedback', params)
    cb(null, ret.id)
  } catch(e) {
    cb(e)
  }
}

module.exports.modWaterMark = async (req, cb) => {
  try {
    const {shopId, waterMark} = req.body
    let payload = { waterMark }
    await dao.update('Shop', shopId, payload)
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.getWatermarkCfg = async (req, cb) => {
  try {
    const {shopId} = req.body
    if (!shopId) {
      cb(new Error('缺少参数'))
      return
    }
    let ret = await dao.list('WatermarkCfg', {columns: {shopId}})
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.saveWatermarkCfg = async (req, cb) => {
  try {
    const { shopId } = req.body
    let ret = await dao.list('WatermarkCfg', {columns: {shopId}})
    if (ret.length) { // 已存在配置
      const id = ret[0].id
      await dao.update('WatermarkCfg', id, {
        ...req.body,
        upd_time: util.getNowTime()
      })
    } else {
      await dao.create('WatermarkCfg', {
        ...req.body,
        add_time: util.getNowTime()
      })
    }
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.auditingImg = async (req, cb) => {
  const {fileName, shopId} = req.body
  const { userInfo: {id: userId} } = req
  try {
    const needAud = await util.isNeedAudImg(shopId)
    if (needAud === false) { // 无需审核
      cb(null, 0)
      return
    }

    const audRes = await cos.getImageAuditing(fileName)
    const ret = await util.handleAudRes(audRes, shopId, userId)
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}