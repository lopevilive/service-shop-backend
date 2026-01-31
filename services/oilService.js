const path = require("path");
const _ = require('lodash');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const util = require(path.join(process.cwd(),"util/index"))
const wxApi = require(path.join(process.cwd(),"modules/wxApi"))
const axios = require('axios');
const mathjs = require('mathjs')

// const expiredTs = 60 * 60 * 0.001
const expiredTs = 60 * 60 * 1

const provList = [
  '青海省', '西藏','广西', '新疆','宁夏','内蒙古', '甘肃省', '陕西省','云南省', '贵州省', '四川省','海南省',
  '广东省', '湖南省','湖北省', '河南省', '山东省','江西省', '福建省', '安徽省','浙江省', '江苏省', '黑龙江省','吉林省',
  '辽宁省', '山西省','河北省', '重庆市', '上海市','天津市', '北京市'
]

const rawOilList = [
  { date: '2025-10-27', wti: '61.310', brent: '64.900'}, { date: '2025-10-28', wti: '60.150', brent: '63.830'}, { date: '2025-10-29', wti: '60.480', brent: '64.320'},
  { date: '2025-10-30', wti: '60.570', brent: '64.370'}, { date: '2025-10-31', wti: '60.980', brent: '64.770'}, { date: '2025-11-03', wti: '61.050', brent: '64.890'},
  { date: '2025-11-04', wti: '60.560', brent: '64.440'}, { date: '2025-11-05', wti: '59.600', brent: '63.520'}, { date: '2025-11-06', wti: '59.430', brent: '63.380'},
  { date: '2025-11-07', wti: '59.750', brent: '63.630'}, { date: '2025-11-10', wti: '60.130', brent: '64.060'}, { date: '2025-11-11', wti: '61.040', brent: '65.160'},
  { date: '2025-11-12', wti: '58.490', brent: '62.710'}, { date: '2025-11-13', wti: '58.690', brent: '63.010'}, { date: '2025-11-14', wti: '60.090', brent: '64.390'},
  { date: '2025-11-17', wti: '59.860', brent: '64.200'}, { date: '2025-11-18', wti: '60.670', brent: '64.890'}, { date: '2025-11-19', wti: '59.250', brent: '63.510'},
  { date: '2025-11-20', wti: '59.000', brent: '63.380'}, { date: '2025-11-21', wti: '58.060', brent: '62.560'}, { date: '2025-11-24', wti: '58.840', brent: '62.720'},
  { date: '2025-11-25', wti: '57.950', brent: '61.800'}, { date: '2025-11-26', wti: '58.650', brent: '62.540'}, { date: '2025-11-27', wti: '58.650', brent: '62.540'},
  { date: '2025-11-28', wti: '58.550', brent: '62.380'}, { date: '2025-12-01', wti: '59.320', brent: '63.170'}, { date: '2025-12-02', wti: '58.640', brent: '62.450'},
  { date: '2025-12-03', wti: '58.950', brent: '62.670'}, { date: '2025-12-04', wti: '59.670', brent: '63.260'}, { date: '2025-12-05', wti: '60.080', brent: '63.750'},
  { date: '2025-12-08', wti: '58.880', brent: '62.490'}, { date: '2025-12-09', wti: '58.250', brent: '61.940'}, { date: '2025-12-10', wti: '58.600', brent: '62.210'},
  { date: '2025-12-11', wti: '57.600', brent: '61.280'}, { date: '2025-12-12', wti: '57.440', brent: '61.120'}, { date: '2025-12-15', wti: '56.820', brent: '60.560'},
  { date: '2025-12-16', wti: '55.270', brent: '58.920'}, { date: '2025-12-17', wti: '55.810', brent: '59.680'}, { date: '2025-12-18', wti: '56.000', brent: '59.820'},
  { date: '2025-12-19', wti: '56.520', brent: '60.470'}, { date: '2025-12-22', wti: '58.010', brent: '62.070'}, { date: '2025-12-23', wti: '58.380', brent: '62.380'},
  { date: '2025-12-24', wti: '58.350', brent: '62.240'}, { date: '2025-12-25', wti: '58.403', brent: '62.264'}, { date: '2025-12-26', wti: '56.740', brent: '60.240'},
  { date: '2025-12-29', wti: '58.080', brent: '61.490'}, { date: '2025-12-30', wti: '57.950', brent: '61.330'}, { date: '2025-12-31', wti: '57.420', brent: '60.850'},
  { date: '2026-01-02', wti: '57.320', brent: '60.750'}, { date: '2026-01-05', wti: '58.320', brent: '61.760'}, { date: '2026-01-06', wti: '57.130', brent: '60.700'},
  { date: '2026-01-07', wti: '55.990', brent: '59.960'}, { date: '2026-01-08', wti: '57.760', brent: '61.990'},
  { date: '2026-01-09', wti: '59.120', brent: '63.340'},
  { date: '2026-01-12', wti: '59.500', brent: '63.870'},
  { date: '2026-01-13', wti: '61.150', brent: '65.470'},
  { date: '2026-01-14', wti: '62.020', brent: '66.520'},
  { date: '2026-01-15', wti: '59.080', brent: '63.760'},
  { date: '2026-01-16', wti: '59.340', brent: '64.130'},
  { date: '2026-01-20', wti: '60.360', brent: '64.920'},
  { date: '2026-01-21', wti: '60.620', brent: '65.240'},
  { date: '2026-01-22', wti: '59.360', brent: '64.060'},
  { date: '2026-01-23', wti: '61.070', brent: '65.880'},
  { date: '2026-01-26', wti: '60.630', brent: '65.590'},
  { date: '2026-01-27', wti: '62.390', brent: '67.570'},
  { date: '2026-01-28', wti: '63.210', brent: '67.370'},
  { date: '2026-01-29', wti: '65.420', brent: '69.590'},
  { date: '2026-01-30', wti: '65.740', brent: '69.820'},
  
]


// 获取上个调价日、当前调价日、下个调价日
const getOilDate = async (transactionalEntityManager, inpTs = util.getTodayTs()) => {
  const instance = await transactionalEntityManager.createQueryBuilder('ZaList', 'ZaList');
  instance
    .setLock('pessimistic_write')
    .where('ZaList.dataType = 2')
    .orderBy('ZaList.id', 'DESC');
  let list = await instance.getMany()
  list = list.reverse()
  let nextDate = null // 下一个调价日时间戳
  let currDate = null // 当前调价日时间戳
  let currDateStr = ''
  let preDate = null // 上一个调价日时间戳
  for (const item of list) {
    const itemTs = item.dateTs + 60 * 60 *24 // 调价日第二天才会生效
    if (itemTs > inpTs) {
      if (!nextDate) nextDate = item.dateTs
    }
    if (inpTs >= itemTs) {
      currDate = item.dateTs
      currDateStr = item.content
    }
  }
  if (!currDate) return false
  if (!nextDate) { // 下个调价日还没创建
    const curryear = util.getBeijingYear()
    const weekDays = [ ...util.getYearWorkdays(curryear - 1), ...util.getYearWorkdays(), ...util.getYearWorkdays(curryear + 1) ]
    let start = false
    let num = 0
    let nextStr = ''
    for (const item of weekDays) {
      if (item === currDateStr) {
        start = true
        continue
      }
      if (start === false) continue
      num += 1
      if (num === 10) {
        nextStr = item
      }
    }
    if (nextStr) {
      nextDate = util.dateStr2Ts(nextStr)
      await transactionalEntityManager.save('ZaList',{
        dataType: 2, dateTs: nextDate, content: nextStr, add_time: util.getNowTime() 
      })
    }
  }
  for (const item of list) {
    if (currDate > item.dateTs) preDate = item.dateTs
  }
  const ret = {preDate, currDate, nextDate}
  return ret
}

const getDefaultData = () => {
  const oilList = provList.map((prov) => {
    return {
      prov,
      price: { p89: '', p92:'', p95: '', p98: '',  p0:''}, // 实际的价格
      calcuPrice: { p89: '', p92:'', p95: '', p98: '',  p0:''}, // 计算出的价格
    }
  })
  return {
    oilList,
    calcuOilChange: '', // 计算出的原油价格变化，取10日平均
    oilChange: '', // 原油价格变化，取发改委数据
    lastUpdateTs: '', // 最后更新时间
  }
}

const getOilData = async (transactionalEntityManager, dateTs) => {
  const instance = await transactionalEntityManager.createQueryBuilder('ZaList', 'ZaList');
  instance
    .setLock('pessimistic_write')
    .where('ZaList.dataType = 1')
    .andWhere('ZaList.dateTs = :dateTs', {dateTs} );
  let ret = await instance.getOne()
  if (!ret) {
    const defaultData = getDefaultData()
    await transactionalEntityManager.save('ZaList',{
      dataType: 1, dateTs, add_time: util.getNowTime(), content: JSON.stringify(defaultData)
    })
  }
  ret = await instance.getOne()
  return ret
}

const getAveOilPrice = async (dateList, oilType = 'brent') => {
  let matchNums = 0 // 多少天有数据
  let total = mathjs.bignumber(0)
  for (const item of dateList) {
    const matchItem = rawOilList.find((tmp) => tmp.date === item)
    if (!matchItem) continue
    matchNums += 1
    total = mathjs.add(total, mathjs.bignumber(matchItem[oilType]))
  }
  if (matchNums <= 2) { // 至少有3条数据才有效
    // console.log(`no oil data ${oilType}`, matchNums, dateList)
    return ''
  }
  let ret = mathjs.divide(total, mathjs.bignumber(matchNums))
  ret = mathjs.format(ret, {notation: 'fixed', precision: 3})
  return ret
}

const calcuRawOil = async (ts) => {
  const curryear = util.getBeijingYear()
  const weekDays = [ ...util.getYearWorkdays(curryear - 1), ...util.getYearWorkdays(), ...util.getYearWorkdays(curryear + 1) ]
  const tsStr = util.dateTs2Str(ts, 'YYYY-MM-DD')
  const idx = weekDays.findIndex((item) => item === tsStr)
  let preIdx = idx
  let nextIdx = idx + 1
  const preList = [] // 上个周期的工作日 
  const nextList = [] // 下个周期的工作日
  while(preList.length < 10) {
    preList.push(weekDays[preIdx])
    if (weekDays[nextIdx]) {
      nextList.push(weekDays[nextIdx])
    }
    preIdx -= 1
    nextIdx += 1
  }
  
  const preAveBrent = await getAveOilPrice(preList)
  const nextAveBrent = await getAveOilPrice(nextList)
  const preAveWti = await getAveOilPrice(preList, 'wti')
  const nextAveWti = await getAveOilPrice(nextList, 'wti')
  if ([preAveBrent, nextAveBrent, preAveWti, nextAveWti].includes('')) {
    return ''
  }
  const prev = {brent: String(preAveBrent), wti: String(preAveWti)}
  const curr = {brent: String(nextAveBrent), wti: String(nextAveWti)}
  const res = util.calculateOilPriceAdjustment(prev, curr, '7.01')
  // console.log(preList)
  // console.log(nextList)
  return util.roundDownToMultipleOfFive(res)
}

// 更新计算的原油变化
const updateOilPrice = async (transactionalEntityManager, ts, preTs) => {
  const data = await getOilData(transactionalEntityManager, ts)
  if (!data) return
  const content = JSON.parse(data.content)
  if (content.oilChange) return // 已经设置了发改委的数据
  const priceChange = await calcuRawOil(preTs)
  content.calcuOilChange = priceChange
  content.lastUpdateTs = String(util.getNowTime())
  await transactionalEntityManager.update('ZaList', {id: data.id}, {content: JSON.stringify(content)})
}


/**
 * 输入成品油变化x/吨，返回每升变化多少元
 * oilChange -170
 * preN5Price 0.0045
 */
const getChangePrice = (oilChange, preN5Price = 0.0045) => {
  const n5 = mathjs.floor(mathjs.divide(oilChange, 5))
  let change = mathjs.multiply(mathjs.bignumber(n5), mathjs.bignumber(preN5Price))
  change = mathjs.format(change, {notation: 'fixed', precision: 2})
  return change
}


// 更新成品油预测数据
const updateCalcuPrice = async (transactionalEntityManager, payload) => {
  const {currDate, preDate} = payload
  const currData = await getOilData(transactionalEntityManager, currDate)
  const preData = await getOilData(transactionalEntityManager, preDate)
  const preContent = JSON.parse(preData.content)
  const currContent = JSON.parse(currData.content)
  const oilChange = currContent.oilChange || currContent.calcuOilChange // 优先取发改委的数据
  if (oilChange === '') return
  const change = getChangePrice(oilChange, 0.0045)
  for (const preItem of preContent.oilList) {
    const pList = ['p0', 'p92', 'p95', 'p98'] 
    while(pList.length) {
      const pKey = pList.pop()
      const val = preItem.price[pKey]
      if (!val) continue
      const currItem = currContent.oilList.find((item) => item.prov === preItem.prov)
      if (!currItem) continue
      currItem.calcuPrice[pKey] = mathjs.format(mathjs.add(val, change), {notation: 'fixed', precision: 2})
    }
  }
  currContent.lastUpdateTs = util.getNowTime()
  await transactionalEntityManager.update('ZaList', {id: currData.id}, {content: JSON.stringify(currContent)})
}

// 获取单个地区的接口
/**
 * {
    prov: '广东',
    p0: '6.34',
    p89: '6.24',
    p92: '6.73',
    p95: '7.29',
    p98: '9.29'
  }
 */
const singleApiList = [
  async (ts,  prov) => {
    const ret = await axios.get(`https://api.qqsuu.cn/api/dm-oilprice?prov=${util.removeRegionSuffix(prov)}`)
    const data = ret.data.data
    // console.log(data)
    const retTs = util.dateStr2Ts(data.time)
    if (retTs >= ts) { // 有效时间
      delete data.time
      return [data]
    }
  },
]

// 获取全部地区的接口
const mulApiList = [
  async (ts, prov) => {
    const ret = await axios.get('https://v2.xxapi.cn/api/oilPrice')
    const list = []
    for (const item of ret.data.data){
      const retTs = util.dateStr2Ts(item.date)
      if (retTs >= ts) {
        list.push({
          prov: util.removeRegionSuffix(item.regionName),
          p0: String(item.n0),
          p92: String(item.n92),
          p95: String(item.n95),
          p98: String(item.n98),
        })
      }
    }
    return list
  }
]


// 通过调接口更新油价
const updateWithApi = async (transactionalEntityManager, payload) => {
  const {currDate, prov} = payload
  const currData = await getOilData(transactionalEntityManager, currDate)
  const currContent = JSON.parse(currData.content)
  const currOilItem = currContent.oilList.find((item) => item.prov === prov)
  if (currOilItem.price.p92) return
  const singleCm = new util.ConcurrencyManage()
  const mulCm = new util.ConcurrencyManage()
  console.log(8)
  for (const fn of singleApiList) {
    singleCm.add(async () => fn(currDate + 60 * 60 *24, prov))
  }
  for (const fn of mulApiList) {
    mulCm.add(async () => fn(currDate + 60 * 60 *24, prov))
  }
  const singlePromise = singleCm.run(3000); // 提前启动，后台执行
  const mulPromise = mulCm.run(3000);       // 优先等这个

  let apiRet = await mulPromise;
  if (!apiRet) {
    apiRet = await singlePromise
  }
  if (!apiRet) return
  for (const item of currContent.oilList) {
    const itemProv = util.removeRegionSuffix(item.prov)
    const matchedApiItem = apiRet.find((tmp) => tmp.prov === itemProv)
    if (!matchedApiItem) continue
    const pList = ['p0', 'p92', 'p95', 'p98'] 
    while(pList.length) {
      const pKey = pList.pop()
      if (matchedApiItem[pKey]) item.price[pKey] = String(matchedApiItem[pKey])
    }
  }
  await transactionalEntityManager.update('ZaList', {id: currData.id}, {content: JSON.stringify(currContent)})

  

}

const updateCurrOilInfo = async (transactionalEntityManager, payload) => {
  const {preDate, currDate, prov} = payload
  const currData = await getOilData(transactionalEntityManager, currDate)
  let currContent = JSON.parse(currData.content)
  let currOilItem = currContent.oilList.find((item) => item.prov === prov)
  if (!currOilItem) throw new Error('参数有误')
  if (currOilItem.price.p92 && (currContent.oilChange || currContent.calcuOilChange)) { // 已经有确定数据了
    console.log(1)
    return
  }
  if (util.validTs(currContent.lastUpdateTs, expiredTs) && currOilItem.calcuPrice.p92) { // 缓存时间内更新过了，直接取计算的数据
    console.log(2)
    return
  }
  console.log(3)
  await updateOilPrice(transactionalEntityManager, currDate, preDate) // 先更新原油价格
  await updateCalcuPrice(transactionalEntityManager, {currDate, preDate}) // 更新成品油价格
  await updateWithApi(transactionalEntityManager, {currDate, prov}) // 调接口尝试更新
}

const updateNextOilInfo = async (transactionalEntityManager, payload) => {
  const {nextDate, currDate} = payload
  const nextData = await getOilData(transactionalEntityManager, nextDate)
  const nextContent = JSON.parse(nextData.content)
  if (nextContent.oilChange) {
    console.log(5)
    return // 已经设置了下次原油价格
  }
  if (util.validTs(nextContent.lastUpdateTs, expiredTs)) {
    console.log(6)
    return // 指定时间内更新过了
  }
  console.log(7)
  await updateOilPrice(transactionalEntityManager, nextDate, currDate)
}

const getDefaultRetData = () => {
  return {
    price: {}, prov: '', priceChangeMap: {},
    updateTime: 0, // 数据更新时间
    nextTime: 0, //下次调价日生效时间
    real: false, // 是否真实数据
    nextOilChange: '', currOilChange: '',
    nextChangeRange: ['', ''], currChangeRange: ['', '']
  }
}

const getChangeRange = (oilChange) => {
  const ret = ['', '']
  if (!oilChange) return ret
  ret[0] = String(mathjs.abs(getChangePrice(oilChange, 0.004)))
  ret[1] = String(mathjs.abs(getChangePrice(oilChange, 0.005)))
  return ret
}

const getPriceChange = (currData, preData, prov)  => {
  const ret = {}
  const currContent = JSON.parse(currData.content)
  const currOilItem = currContent.oilList.find((item) => item.prov === prov)
  const currPrice = currOilItem.price.p92 ? currOilItem.price : currOilItem.calcuPrice
  const preContent = JSON.parse(preData.content)
  const preOilItem = preContent.oilList.find((item) => item.prov === prov)
  const prePrice = preOilItem.price
  if (!prePrice.p92 || !currPrice.p92) {
    return ret
  }
  const pList = ['p0', 'p89', 'p92', 'p95', 'p98'] 
  while(pList.length) {
    const pKey = pList.pop()
    if (!prePrice[pKey] || !currPrice[pKey]) continue
    let range = mathjs.subtract(prePrice[pKey], currPrice[pKey])
    range = mathjs.abs(range)
    range = mathjs.format(range, {notation: 'fixed', precision: 2})
    ret[pKey] = range
  }
  return ret
}


const getInfo = async (prov) => {
  if (!prov) throw new Error('参数缺失～')
  const manager = await dao.getManager()
  const ret = await manager.transaction(async (transactionalEntityManager) => {
    const {preDate, currDate, nextDate} = await getOilDate(transactionalEntityManager)
    await updateCurrOilInfo(transactionalEntityManager, {preDate, currDate, prov})
    await updateNextOilInfo(transactionalEntityManager, {nextDate, currDate})
    const preData = await getOilData(transactionalEntityManager, preDate)
    const currData = await getOilData(transactionalEntityManager, currDate)
    const nextData = await getOilData(transactionalEntityManager, nextDate)
    const currContent = JSON.parse(currData.content)
    const nextContent = JSON.parse(nextData.content)
    const currOilItem = currContent.oilList.find((item) => item.prov === prov)
    const retData = getDefaultRetData()
    retData.prov = prov
    retData.updateTime = currDate + 60 * 60 * 24
    retData.nextTime = nextDate + 60 * 60 * 24
    retData.currOilChange = currContent.oilChange || currContent.calcuOilChange
    if (currOilItem.price.p92) {
      retData.price = currOilItem.price
      retData.real = true
    } else {
      retData.price = currOilItem.calcuPrice
    }
    retData.nextOilChange = nextContent.oilChange || nextContent.calcuOilChange
    retData.currChangeRange = getChangeRange(retData.currOilChange)
    retData.nextChangeRange = getChangeRange(retData.nextOilChange)
    retData.priceChangeMap = getPriceChange(currData, preData, prov)
    return retData
  })
  return ret
}


module.exports.getOilInfo = async (req, cb) => {
  try {
    const ret = await getInfo(req.body.prov)
    cb(null,  ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.login = async (req, cb) => {
  try {
    const { code } = req.body
    const {appid, secret} = util.getConfig('oil.appInfo')
    const token = await wxApi.login({code, appid, secret, dbName: 'ZaUser'})
    cb(null, token)
  } catch(e) {
    cb(e)
  }
}

module.exports.getUserInfo = async (req, cb) => {
  try {
    const userInfo = req.userInfo
    const ret = {
      userId: userInfo.id,
      addTime: userInfo.add_time,
      prov: userInfo.prov || ''
    }
    cb(null, ret)
  } catch(e) {
    cb(e)
  }
}

module.exports.updateProv = async (req, cb) => {
  try {
    const {id} = req.userInfo
    const {prov} = req.body
    await dao.update('ZaUser', id, {prov})
    cb(null,)
  } catch(e) {
    cb(e)
  }
}

