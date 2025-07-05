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