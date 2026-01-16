const path = require("path");
const _ = require('lodash');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))
const cos = require(path.join(process.cwd(),"modules/cos"))
const {createTicket, verifyTicket} = require(path.join(process.cwd(),"modules/ticketManage"));
const { In, Like, Brackets } = require("typeorm");
const axios = require('axios');
const ExcelJS = require('exceljs/dist/es5');
const crypto = require('crypto');
const fs = require('fs');
const mathjs = require('mathjs')
const wxApi = require(path.join(process.cwd(),"modules/wxApi"))
const contentValid = require(path.join(process.cwd(),"modules/contentValid"))

const validExec = async (strList, payload) => {
  const {openid, userId, shopId} = payload
  const newStrList = util.joinStrArrayWithLimit(strList, 2000)
  const pList = newStrList.map((str) => {
    return contentValid.albumValidText({openid, userId, shopId, content: str})
  })
  const validRes = await Promise.all(pList)
  for (const validItem of validRes) {
    if (validItem.pass === false) {
      throw new Error(validItem.msg || '系统繁忙~')
    }
  }
}


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
    'attrs', 'level', 'status', 'encry', 'waterMark', 'auditing', 'addressStatus',
    'inveExportStatus', 'bannerStatus', 'bannerCfg', 'expiredTime', 'requiredType', 'typeStatus',
    'forwardPermi', 'typeSideMod', 'specsCfg', 'showContact'
  ]
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
    const sups = util.getConfig('album.superAdmin')
    if (!sups.includes(userInfo.id)) {
      const res = await dao.list('Shop', {columns: {userId: userInfo.id}})
      if (res.length) {
        throw new Error('每个用户暂时只能创建 1 个图册~')
      }
    }

    await validExec([params.name, params.desc], {openid: userInfo.openid, userId: userInfo.id, shopId: 0})
    const data = await dao.create('Shop', {...params, userId: userInfo.id, add_time: util.getNowTime(), inveExportStatus: 1})
    cb(null, data.id)
  } catch(e) {
    cb(e)
  }
}

module.exports.shopMod = async (req ,cb) => {
  const {userInfo} = req
  const params = {
    id: req.body.id,
    desc: req.body.desc,
    url: req.body.url,
    name: req.body.name,
    area: req.body.area,
    address: req.body.address,
    phone: req.body.phone,
    qrcodeUrl: req.body.qrcodeUrl,
    business: req.body.business,
    attrs: req.body.attrs,
    showContact: req.body.showContact || 0,
    upd_time: util.getNowTime()
  }
  const {id} = params
  try {
    await validExec([
      params.desc, params.name, params.address, params.phone
    ], {openid: userInfo.openid, userId: userInfo.id, shopId: params.id})
    await dao.update('Shop', id, params)
    cb(null, id)
  } catch(e) {
    cb(e)
  }
}

module.exports.productMod = async (req ,cb) => {
  const {shopInfo: {status}, userInfo} = req
  const params = req.body
  const { id, shopId } = params

  if (status === 1) {
    cb(new Error('未知错误，请重启小程序*'))
    return
  }
  try {
    await validExec([
      params.desc, params.specDetials, params.price, params.attr
    ], {openid: userInfo.openid, userId: userInfo.id, shopId})
  } catch(e) {
    cb(e)
    return
  }
  if (id === 0) { // 创建
    try {
      let countRes = await dao.count('Product', {shopId})
      const count = countRes[0]['total']
      const vailRes = util.vailCount(req.shopInfo, count)
      if (!vailRes.pass) {
        // 超过限制数量
        cb(null, vailRes)
        return
      }
      let maxPos = 0
      const res = await dao.list('Product', {columns: {shopId}, only: ['id', 'pos'], order: {pos: 'DESC'}, take: 1})
      if (res.length === 1) {
        maxPos = res[0].pos
      }
      const data = await dao.create('Product', {...params, add_time: util.getNowTime(), pos: maxPos + 10000})
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
      'Product.id', 'Product.desc', 'Product.price', 'Product.productType', 'Product.shopId', 'Product.url',
      'Product.type3D', 'Product.model3D', 'Product.modelUrl', 'Product.status', 'Product.fields', 'Product.sort',
      'Product.attr', 'Product.isSpec', 'Product.upd_time', 'Product.specDetials', 'Product.descUrl', 'Product.isMulType'
    ])
    queryBuild.where('1 = 1')
    if (shopId) queryBuild.andWhere('Product.shopId = :shopId', {shopId})
    if (productId) {
      let ids = productId
      if (!Array.isArray(productId)) ids = [productId]
      queryBuild.andWhere('Product.id IN (:...ids)', {ids})
    }
    let typeDone = false
    if (productType === '-1') { //选未分类的产品
      queryBuild.andWhere('Product.productType = :productType', {productType: ''})
      typeDone = true
    }
    if (productType === '0') { // 选全部，不用处理
      typeDone = true
    }
    if (productType && !typeDone) {
      queryBuild.andWhere(new Brackets((qb) => {
        qb.orWhere('Product.productType Like :a', {a: `%,${productType},%`})
          .orWhere('Product.productType Like :b', {b: `%,${productType}-%`})
      }))
    }
    
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
    queryBuild.addOrderBy('Product.pos', 'DESC')
    queryBuild.addOrderBy('Product.id', 'DESC')
    
    const data = await queryBuild.getMany()

    if (shopId) {
      let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
      shopInfo = shopInfo[0]
      const countRes = await dao.count('Product', {shopId, status: 0}, 'productType')
      for (const item of countRes) {
        total += Number(item.total) // 总数
        if (!item.productType) {
          unCateNum += Number(item.total) // 未分类数量
        }
      }
      const downNumRes = await dao.count('Product', {shopId, status: 1})
      if (downNumRes && downNumRes[0] && downNumRes[0].total) {
        downNum = Number(downNumRes[0].total); // 下架数量
        total += downNum;
      }
      let vailRes = util.vailCount(shopInfo, total)
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

  cond.only = ['id', 'name', 'shopId', 'parentId']
  cond.order = {sort: 'DESC', id: 'ASC'}
  cond.take = 1000 // 限制数量
  try {
    const data = await dao.list('ProductTypes', cond)
    const ret = {shopId, list: data}
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.modProdTypesSort = async (params, cb) => {
  const { list } = params
  try {
    let idx = list.length
    for (const item of list) {
      await dao.update('ProductTypes', item.id, {sort: idx} )
      idx -= 1;
    }
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.productTypesMod = async (req ,cb) => {
  try {
    const {userInfo, body} = req
    let {data: payload, shopId} = body
    let isMod = false
    const validStr = payload.map((item) => item.name)
    await validExec(validStr, {openid: userInfo.openid, userId: userInfo.id, shopId})
    for (const item of payload) {
      if (item.id) { // 编辑
        isMod = true
        item['upd_time'] = util.getNowTime()
      } else { // 新增
        item['add_time'] = util.getNowTime()
      }
    }
    if (!isMod) { // 创建
      const data = await dao.create('ProductTypes', payload)
      cb(null, data)
    } else { // 修改
      payload = payload[0]
      const data = await dao.update('ProductTypes', payload.id, payload)
      cb(null, data)
    }
  } catch(e) {
    cb(e)
  }
}

module.exports.productTypesDel = async (params, cb) => {
  let {id} = params

  const updateType = async (prodList, regStr) => {
    if (!prodList.length) return
    const singleList = [] // 只配置了1个分类
    for (const item of prodList) {
      const t = item.productType
      let tList = t.split(',')
      tList = tList.filter((i) => !!i)
      if (tList.length === 1) {
        singleList.push(item)
        continue
      }
      tList = tList.filter((i) => {
        const reg = new RegExp(`${regStr}`)
        if (reg.test(i)) return false
        return true
      })
      if (tList.length === 0) {
        singleList.push(item)
        continue
      }
      let newStr = tList.join(',')
      newStr = `,${newStr},`
      await dao.update('Product', item.id, {productType: newStr})
    }
    const ids = singleList.map((item) => item.id)
    if (ids.length) {
      await dao.update('Product', ids, {productType: ''})
    }
  }

  try {
    let info = await dao.list('ProductTypes', {columns: {id}})
    if (!info.length) {
      cb(null)
      return
    }
    info = info[0]
    if (!info.parentId) { // 一级分类
      const subTypes = await dao.list('ProductTypes', {columns: {parentId: id}})
      if (subTypes.length) { // 有子分类
        const ids = subTypes.map((item) => item.id)
        await dao.delete('ProductTypes', ids)
      }
      const l1 = await dao.list('Product', {columns:{productType: Like(`%,${id},%`)}})
      const l2 = await dao.list('Product', {columns:{productType: Like(`%,${id}-%`)}})
      await updateType([...l1, ...l2], `${id}`)
    } else {
      // 二级分类
      let parent = await dao.list('ProductTypes', {columns: {id: info.parentId}})
      if (parent.length) {
        parent = parent[0]
        const prodList = await dao.list('Product', {columns: {productType: Like(`%,${parent.id}-${id},%`)}})
        await updateType(prodList, `${parent.id}-${id}`)
      }
    }
    await dao.delete('ProductTypes', id)
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
  const {shopInfo, userInfo} = req
  const {nickName, type} = req.body

  try {
    const ticket = createTicket('createStaff', 60 * 60 * 4) //4小时内有效
    await validExec([nickName], {openid: userInfo.openid, userId: userInfo.id, shopId: shopInfo.id})
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
  const {userInfo: {id: userId, openid}} = req
  const params = {...req.body}
  params.isDefault = params.isDefault ? 1 : 0
  try {
    await validExec([params.addressDetail, params.tel, params.name], {openid, userId, shopId: 0})
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
  const {add, multiply, bignumber} = mathjs
  try {
    const {userInfo, body} = req
    let params = {
      userId: userInfo.id,
      shopId: +body.shopId,
      add_time: util.getNowTime(),
      type: body.type
    }
    const d = JSON.parse(body.data)
    await validExec([d.remark], {openid: userInfo.openid, userId: userInfo.id, shopId: 0})
    if (body.type === 0) {
      params.orderId = util.createOrderId('DD', params.add_time)
    }
    const {list} = d
    let totalCount = 0
    let totalPrice = 0
    for (const prodInfo of list) {
      totalCount += prodInfo.count
      if (prodInfo.price === '') totalPrice = '--'
      if (totalPrice !== '--') {
        let tmp = multiply(bignumber(Number(prodInfo.price)), bignumber(Number(prodInfo.count)))
        totalPrice = add(totalPrice, tmp)
      }
    }
    const newData = {
      ...d,
      totalCount: totalCount,
      totalPrice: `${totalPrice}`
    }
    params.data = JSON.stringify(newData)
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
  const only = ['id', 'add_time', 'data', 'status', 'orderId', 'userId']
  try {
    const ret = await dao.list('Enventory', {columns, only, take, order: {id: 'DESC'}})
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.exportInventory = async (req, cb) => { // 弃用
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
    const dateStr = util.dateTs2Str(info.add_time, 'YYYY/MM/DD HH:mm')
    sheet.addRow([`创建时间： ${dateStr}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
    })

    const md5 = crypto.createHash('md5').update(`${id}-${util.getNowTime()}`).digest('hex')
    const env = util.getConfig('default.env')
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

module.exports.exportInventoryV2 = async (req, cb) => {
  const {id} = req.query
  if (!id) return cb(new Error('参数有误'))
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
    });
    let idx = 1;
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
    idx += 1;
    sheet.addRow([`总价格： ${data.totalPrice}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
      cell.font = {size: 15, bold: true}
    });
    idx += 1;
    sheet.addRow([`总数量： ${data.totalCount}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
      cell.font = {size: 15, bold: true}
    });
    idx += 1;
    sheet.addRow([`备注： ${data.remark}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
      cell.font = {size: 15, bold: true}
    });
    idx += 1;
    sheet.addRow([`收货地址： ${data.address}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
      cell.font = {size: 15, bold: true}
    });
    idx += 1;
    const dateStr = util.dateTs2Str(info.add_time, 'YYYY/MM/DD HH:mm')
    sheet.addRow([`创建时间： ${dateStr}`])
    sheet.mergeCells(`A${idx}:F${idx}`)
    sheet.getRow(idx).eachCell({includeEmpty: false}, (cell) => {
      cell.alignment = {vertical: 'middle'}
    });
    const md5 = crypto.createHash('md5').update(`${id}-${util.getNowTime()}`).digest('hex');
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const url = await new Promise((resolve, reject) => {
      cos.cosInstance.putObject({
        Bucket: cos.cfg.bucket,
        Region: cos.cfg.region,
        Key: `album-export/inven${info.shopId}-${md5}.xlsx`,
        Body: excelBuffer,
        ACL: 'public-read',
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }, (err, data) => {
        if (err) {
          console.error('COS上传失败：', err);
          reject(err);
        } else {
          const cosUrl = `https://${data.Location}`;
          resolve(cosUrl);
        }
      })
    })
    cb(null, url);
  } catch(e) {
    cb(e)
  }
}

module.exports.getwxacodeunlimit = async (req, cb) => {
  try {
    const {appid, secret} = util.getConfig('album.appInfo');
    const {scene} = req.body;
    // 获取 access_token
    const access_token = await wxApi.getAccessToken({appid, secret})
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
    const {body: {shopId, text}, userInfo} = req
    await validExec([text], {openid: userInfo.openid, userId: userInfo.id, shopId})
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
  try {
    const ret = await contentValid.albumValidImg({fileName, shopId, userInfo: req.userInfo})
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.getCusInventory = async (req, cb) => {
  const {shopId, pageSize, currPage, status} = req.body
  try {
    const queryBuild = await dao.createQueryBuilder('Enventory')
    queryBuild.select([
      'Enventory.id', 'Enventory.add_time', 'Enventory.data', 'Enventory.status', 'Enventory.orderId'
    ])
    queryBuild.where('1 = 1')
    queryBuild.andWhere('Enventory.shopId = :shopId', {shopId})
    if (util.isIntegerString(status)) {
      queryBuild.andWhere('Enventory.status = :status', {status})
    }
    queryBuild.andWhere('Enventory.type = 0')
    const sizeLimit = pageSize || 10;
    queryBuild.limit(sizeLimit);
    if (currPage > 0) queryBuild.offset(currPage * sizeLimit);
    queryBuild.orderBy('Enventory.id', 'DESC')
    const list = await queryBuild.getMany()
    const ret = {list}
    ret.finished = list.length === sizeLimit ? false: true
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.modInventoryStatus = async (req, cb) => {
  const { id, status, shopId, isAll } = req.body
  try {
    if (isAll) {
      if (!shopId) {
        cb(new Error('参数有误～'))
        return
      }
      let queryBuild = await dao.createQueryBuilder('Enventory')
      queryBuild = queryBuild.update('Enventory')
      queryBuild.set({status, upd_time: util.getNowTime()})
      queryBuild.where('Enventory.shopId = :shopId', {shopId})
      queryBuild.andWhere('Enventory.status = 0')
      queryBuild.andWhere('Enventory.type = 0')
      await queryBuild.execute()
    } else {
      await dao.update('Enventory', id, {status, upd_time: util.getNowTime()})
    }
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.modShopStatus = async (req, cb) => {
  try {
    const params = {...req.body}
    params.upd_time = util.getNowTime()
    const { shopId } = params
    delete params.shopId
    if (!shopId) {
      cb(new Error('参数有误~'))
      return
    }
    await dao.update('Shop', shopId, params)
    cb(null)
  } catch(e) {
    cb(e)
  }
}

module.exports.modProductPos = async (req, cb) => {
  try {
    const {shopId, id, type, step, productType} = req.body;
    if (step >= 100000) {
      cb(new Error('数据太大'))
      return
    }

    let curItem = await dao.list('Product', {columns: {id}})
    curItem = curItem[0]
    const curPos = curItem.pos
    const queryBuild = await dao.createQueryBuilder('Product')
    queryBuild.select(['Product.id', 'Product.pos'])
    queryBuild.where('Product.shopId = :shopId', {shopId})
    let typeDone = false
    if (productType === '-1') {
      queryBuild.andWhere('Product.productType = :productType', {productType: ''})
      typeDone= true
    }
    if (productType === '0') {
      typeDone = true
    }
    if (productType === '-2') {
      typeDone = true
    }
    if (productType && !typeDone){
      queryBuild.andWhere(new Brackets((qb) => {
        qb.orWhere('Product.productType Like :a', {a: `%,${productType},%`})
          .orWhere('Product.productType Like :b', {b: `%,${productType}-%`})
      }))
    }
    queryBuild.andWhere('Product.status = :status', {status: productType === '-2' ? 1 : 0})
    if (type === 'top') {
      queryBuild.andWhere('Product.pos > :curPos', {curPos})
      queryBuild.addOrderBy('Product.pos', 'ASC')
    } else {
      queryBuild.andWhere('Product.pos < :curPos', {curPos})
      queryBuild.addOrderBy('Product.pos', 'DESC')
    }
    
    queryBuild.limit(step + 1)
    const list = await queryBuild.getMany()
    let preId = 0
    if (list.length === 0) {
      cb(null, preId)
      return
    }
    let newPos
    let needFormat = false
    if (list.length <= step) {
      const preItem = list.pop()
      if (type === 'top') {
        newPos = preItem.pos + 5000
      } else {
        newPos = Math.floor(preItem.pos / 2)
        preId = preItem.id
      }
      if (newPos < 100) needFormat = true
    } else {
      let aItem = list.pop()
      let a = aItem.pos
      let bItem = list.pop()
      let b = bItem.pos
      newPos = Math.floor((a + b)/2)
      if (Math.abs(a - b) < 100) needFormat = true
      if (type === 'top') {
        preId = aItem.id
      } else {
        preId = bItem.id
      }
    }
    await dao.update('Product', id, {pos: newPos, upd_time: util.getNowTime()})
    if (needFormat) {
      const prodList = await dao.list('Product', {columns: {shopId}, order: {pos: 'DESC'}, only: ['id', 'pos']})
      let len = prodList.length
      for (const {id: productId} of prodList) {
        await dao.update('Product', productId, {pos: len * 10000})
        len -= 1;
      }
    }
    cb(null, preId)
  } catch(e) {
    cb(e)
  }
}

module.exports.getVipInfo = async (req, cb) => {
  const { shopId } = req.body
  try {
    let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
    if (shopInfo.length !== 1) throw new Error('请求出错')
    shopInfo = shopInfo[0]
    const ret = {
      shopId,
      amount: util.getRestAmount(shopInfo.level, shopInfo.expiredTime), // 剩余金额
      level: shopInfo.level,
      expiredTime: shopInfo.expiredTime || 0,
      cfg: util.getConfig('album.levelCfg')
    }
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.report = async (req, cb) => {
  const {field, shopId, isAdmin} = req.body
  try {
    const ts = util.getTodayTs()
    const res = await dao.count('cus_logs', {upd_time: ts})
    let total = Number(res[0].total)
    if (total === 0) { // 插入初始数据
      await dao.create('CusLogs', { logType: 4, content: '{}', add_time: util.getNowTime(), upd_time: ts })
    }

    const manager = await dao.getManager()
    await manager.transaction(async (transactionalEntityManager) => {
      const instance = await transactionalEntityManager.createQueryBuilder('CusLogs', 'CusLogs')
      instance.setLock('pessimistic_write')
      instance.where('CusLogs.logType = 4')
      instance.andWhere('CusLogs.upd_time = :ts', {ts})
      instance.orderBy('CusLogs.id', 'ASC')
      const data = await instance.getOne()
      if (!data) return
      const content = JSON.parse(data.content)
      if (!content[shopId])  content[shopId] = {admin: {}, custom: {}}
      const matchItem = isAdmin ? content[shopId].admin : content[shopId].custom
      if (!matchItem[field]) matchItem[field] =  0
      matchItem[field] += 1
      await transactionalEntityManager.update('CusLogs', {id: data.id}, {
        content: JSON.stringify(content)
      })
      // await util.sleep(3000)
      // console.log('done')
    })
    cb(null)
  } catch(e) {
    cb(e)
  }
}

// 这里处理消息推送配置
module.exports.wxMsgVerify = async (req, cb) => {
  try {
    const { signature, timestamp, nonce, echostr } = req.query;
    const {msgToken, msgEncodingAESKey} = util.getConfig('album.appInfo')
    const arr = [msgToken, timestamp, nonce].sort();
    const str = arr.join('');
    const sha1Str = crypto.createHash('sha1').update(str).digest('hex');
    if (sha1Str === signature) {
      // ✅ 校验成功：原样返回 echostr 字符串 (核心！！！)
      cb(null, echostr)
    } else {
      cb(null, '校验非法')
    }
  } catch(e) {
    cb(e)
  }
}

// 微信推送的消息，在 dev 环境不会执行
module.exports.wxMsgRec = async (req, cb) => {
  try {
    cb(null) // 直接回复微信
    await util.sleep(3000) // 这里避免太快还没创建数据
    const {Event, trace_id} = req.body
    if (Event !== 'wxa_media_check') return
    if (!trace_id) return
    const data = await dao.list('XaCache', {columns: {dataType: 10, key1: trace_id}})
    if (!data.length) return
    let {id, content} = data[0]
    content = JSON.parse(content)
    content.res = req.body
    await dao.update('XaCache', id, {content: JSON.stringify(content), dataType: 11, upd_time: util.getNowTime()})
    await contentValid.albumHandleWxMediaCheck()
  } catch(e) {
    cb(e)
  }
}

// this.wxMsgRec({
//  body: {
//    Event: 'wxa_media_check',
//     trace_id: '6965ef8b-628096bc-2190c0ef'
//  }
// }, ()=> {})