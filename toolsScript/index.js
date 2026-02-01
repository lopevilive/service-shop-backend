const path = require("path");
const _ = require('lodash');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))
const { Like } = require("typeorm");
const cos = require(path.join(process.cwd(),"modules/cos"))
const mathjs = require('mathjs');


const getSpecPrices = (list) => {
  let min = 0
  let max = 0
  let idx = 0
  for (const item of list) {
    let specPrice = +item.price
    idx += 1
    if (idx === 1) {
      min = specPrice
      max = specPrice
      continue
    }
    if (specPrice < min) min = specPrice
    if (specPrice > max) max = specPrice
  }
  return {min, max}
}

module.exports.modPrice = async () => {
  const list = await dao.list('Product', {columns: {isSpec: 1, price: ''}, take: 50})
  console.log(list)

  for (const item of list) {
    const list = JSON.parse(item.specs)
    const {min} = getSpecPrices(list)
    await dao.update('Product', item.id, {price: `${min}`})
  }

}

// 处理历史清单
module.exports.modEnventory = async () => {
  const list = await dao.list('Enventory', {columns: {type: 0, }})
  for (const item of list) {
    const orderId = util.createOrderId('DD', item.add_time)
    await dao.update('Enventory', item.id, {orderId})
  }
}

// 处理产品为位置
module.exports.formatProductPos = async () => {
  const shopList = await dao.list('Shop', {only: ['id']})
  for(const {id: shopId} of shopList) {
    const productList = await dao.list('Product', {columns: {shopId}, order: {id: 'DESC'}, only: ['id']})
    let len = productList.length
    for (const {id: productId} of productList) {
      await dao.update('Product', productId, {pos: len * 10000})
      len -= 1
    }
  }
}

//  处理敏感词
module.exports.formatIllegalWords = async () => {
  const pList = await dao.list('Product', {columns: {desc: Like(`%消灾%`)}, take: 50})
  for (const item of pList) {
    const {desc, id} = item
    let newVal = desc.replaceAll('消灾','')
    if (!newVal) newVal = '-'
    await dao.update('Product', id, {desc: newVal})
    console.log(newVal)
  }
}

module.exports.formatSpecs = async () => {
  const queryBuild = await dao.createQueryBuilder('Product')
  queryBuild.select(['Product.id', 'Product.isSpec', 'Product.specDetials', 'Product.specs', 'Product.shopId'])
  queryBuild.where('1 = 1')
  queryBuild.andWhere('Product.isSpec = 1')
  queryBuild.andWhere(`Product.specDetials is null or Product.specDetials = ''`)
  queryBuild.limit(200)
  const data = await queryBuild.getMany()
  console.log(data)
  // return
  for (const item of data) {
    // if (item.id !== 54) continue
    let rawData
    try {
      rawData = JSON.parse(item.specs)
    } catch(e) {}
    if (!rawData?.length) {
      console.log('出错了', item.id)
      break
    }
    const newData = {
      singleSpecs: [],
      mulSpecs: [],
      singleUseImg: 0,
      mulUseImg: 0,
      mulSpecPriceList: []
    }
    for (const rawItem of rawData) {
      newData.singleSpecs.push({
        name: rawItem.name,
        price: rawItem.price,
        url: ''
      })
    }
    await dao.update('Product', item.id, {specDetials: JSON.stringify(newData)})
  }
}

module.exports.formatTypes = async () => {
  let id = 30139
  const queryBuild = await dao.createQueryBuilder('Product')
  queryBuild.select(['Product.id', 'Product.productType', 'Product.shopId'])
  queryBuild.where('1 = 1')
  queryBuild.andWhere('Product.id > :id', {id: id})
  queryBuild.andWhere('Product.productType IS NOT NULL AND TRIM(Product.productType) != ""')
  queryBuild.limit(2000)
  const data = await queryBuild.getMany()
  for (const item of data) {
    id = item.id
    if (!item.productType) continue
    if (/,/.test(item.productType))  continue
    const newStr = `,${item.productType},`
    await dao.update('Product', id, {productType:  newStr})
  }
  console.log(id)
}



module.exports.formatInventory = async () => {
  const {add, multiply, bignumber} = mathjs
  let id = 3358
  const queryBuild = await dao.createQueryBuilder('Enventory')
  queryBuild.select(['Enventory.id', 'Enventory.data', 'Enventory.shopId'])
  queryBuild.where('1 = 1')
  queryBuild.andWhere('Enventory.id > :id', {id})
  queryBuild.andWhere('Enventory.type = 0')
  // queryBuild.andWhere('Enventory.id = 351')
  queryBuild.limit(500)
  const data = await queryBuild.getMany()
  for (const item of data) {
    id = item.id
    const d = JSON.parse(item.data)
    const {list, totalCount} = d
    let tmpCount = 0
    let totalPrice = 0
    for (const prod of list) {
      tmpCount += prod.count
      if (prod.price === '') totalPrice = '--'
      if (totalPrice !== '--') {
        let tmp = multiply(bignumber(Number(prod.price)), bignumber(Number(prod.count)))
        totalPrice = add(totalPrice, tmp)
      }
    }
    if (tmpCount !== Number(totalCount)) {
      console.log(item)
      const newData = {
        ...d,
        totalCount: tmpCount,
        totalPrice: `${totalPrice}`
      }
      // console.log(JSON.stringify(newData))
      await dao.update('Enventory', item.id, {data: JSON.stringify(newData)})
    }
  }
  console.log(id)
}



module.exports.clearImgs = async () => {
  // Feedback.url
  // Product.url
  // Product.descUrl
  // Product.specDetials
  // Shop.url
  // Shop.bannerCfg
  // WatermarkCfg.previewUrl
  // WatermarkCfg.cfg
  // WatermarkCfg.configkey
  // 大户：20、25、50、88、173、175、176、179、518、532、1074、1094、1158、1201

  // const shopId = 1211
  const Marker = ''

  if (!shopId) return

  const strList = [
    'upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_3_dda7b2170dac6b8a161f072b4b6a62b9.jpg',
    'upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_3_f0fb6556d51a4f1da626a6d92064ac1c.png',
    'upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_3_19a302d6f831268825df5f881abf9b95.png',
    'upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_3_24fd435bee5b919a4c0db50415bf6b97.png'
  ]
  const addData = (list, k) => {
    for (const item of list) {
      if (item[k]) strList.push(item[k])
    }
  }

  const getData = async () => {
    let ret = await dao.list('Feedback')
    addData(ret, 'url')
    ret = await dao.list('Product', {columns: {shopId}})
    addData(ret, 'url')
    addData(ret, 'descUrl')
    addData(ret, 'specDetials')
    ret = await dao.list('Shop', {columns: {id: shopId}})
    addData(ret, 'url')
    addData(ret, 'bannerCfg')
    addData(ret, 'qrcodeUrl')
    ret = await dao.list('WatermarkCfg', {columns: {shopId}})
    addData(ret, 'cfg')
    addData(ret, 'configkey')
  }

  const isUsed = async (key) => {
    for (const str of strList) {
      if (str.includes(key)) return true
    }
    return false
  }

  await getData()
  const moveImg = async (key) => {
    const CopySource = `${cfg.bucket}.cos.${cfg.region}.myqcloud.com/${key}`
    let ret = await cosInstance.sliceCopyFile({
      Bucket: cfg.bucket,
      Region: cfg.region,
      Key: `nouse_${key}`,
      CopySource,
    })
    if (ret.statusCode !== 200) {
      throw new Error('复制出错')
    }
    ret = await cosInstance.deleteObject({
      Bucket: cfg.bucket,
      Region: cfg.region,
      Key: key
    })
    if (ret.statusCode !== 204) {
      throw new Error('删除出错')
    }
  }
  
  const {cosInstance, cfg} = cos
  const res = await cosInstance.getBucket({
    Bucket: cfg.bucket,
    Region: cfg.region,
    Prefix: `${shopId}_`,
    Marker,
    MaxKeys: '1000'
  })
  let lastKey = ''
  console.log('length:', strList.length)
  for (const item of res.Contents) {
    const ret = await isUsed(item.Key)
    if (ret) { // 在使用
      lastKey = item.Key
    } else { // 没在使用
      console.log('nouse: ', item.Key)
      await moveImg(item.Key)
    }
  }
  console.log(`lastKey:`, lastKey)
}

module.exports.formatReport = async () => {
  let data = await dao.list('CusLogs', {order: {id: 'DESC'}, take: 30, columns: {logType: 4} })
  const list = data.map((item) => JSON.parse(item.content))
  let cusInfo = [0, 0, 0] // member openTimes viewDetials
  let adminInfo = [0, 0, 0]
  let cusInfoVip = [0, 0, 0]
  let adminInfoVip = [0, 0, 0]
  const shopInfoMap = {}
  while(list.length) {
    const item = list.pop()
    const shopIds = Object.keys(item).map((item) => Number(item))
    for (const shopId of shopIds) {
      if ([2].includes(shopId)) continue
      const matchItem = item[shopId]
      const {admin, custom} = matchItem
      if (!shopInfoMap[shopId]) {
        const shopInfo = await dao.list('Shop', {columns: {id: shopId}})
        shopInfoMap[shopId] = shopInfo[0]
      }
      const isVip = shopInfoMap[shopId].level > 0
      let tmpCus = isVip ? cusInfoVip : cusInfo
      let tmpAdmin = isVip ? adminInfoVip : adminInfo
      if (admin.member) tmpAdmin[0] += admin.member
      if (admin.openTimes) tmpAdmin[1] += admin.openTimes
      if (admin.viewDetial) tmpAdmin[2] += admin.viewDetial

      if (custom.member) tmpCus[0] += custom.member
      if (custom.openTimes) tmpCus[1] += custom.openTimes
      if (custom.viewDetial) tmpCus[2] += custom.viewDetial
    }
    
  }
  console.log(cusInfo)
  console.log(adminInfo)
  console.log(cusInfoVip)
  console.log(adminInfoVip)
}


module.exports.formatSpecPrice = async () => {
  const queryBuild = await dao.createQueryBuilder('Product')
  queryBuild.select(['Product.id','Product.shopId','Product.desc', 'Product.isSpec', 'Product.specDetials'])
  queryBuild.where('1 = 1')
  queryBuild.andWhere('Product.price = :a', {a: 'NaN'})
  queryBuild.limit(50)
  const data = await queryBuild.getMany()
  console.log(data)

}


const init = async () => {
  setTimeout(() => {
    // this.formatSpecPrice()
  }, 0);
}

init()
