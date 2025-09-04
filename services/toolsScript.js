const path = require("path");
const _ = require('lodash');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))
const { Like } = require("typeorm");


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