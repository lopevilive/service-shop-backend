// 批量上传处理方法
const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const dao = require(path.join(process.cwd(),"dao/DAO"));
const cos = require(path.join(process.cwd(),"modules/cos"))
const fs = require("fs");
const os = require('os')
const unzipper = require('unzipper');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const COS = require('cos-nodejs-sdk-v5');

const priceReg = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/

function parseSpec(str) {
  if (!str || typeof str !== 'string') return []

  // ✅ 先去所有空格
  const cleaned = str.replace(/\s+/g, '')

  return cleaned
    .split('|')
    .map(item => {
      const parts = item.split(':')
      if (parts.length !== 2) return null

      const name = parts[0]
      const values = parts[1].split(',').filter(Boolean)

      if (!name || !values.length) return null

      return { name, val: values }
    })
    .filter(Boolean)
}

class ProcessBatchUpload {
  constructor() {
    this.taskList = []
    this.runingList = []


    // ------运行任务时，该任务需要用到的变量，完成任务需要初始化 --s
    this.zipPath = ''
    this.excelFile = []
    this.imageFiles = []
    this.excelData = []
    this.products = []
    this.shopId = null
    this.userId = null
    this.taskId = null
    this.shopInfo = {}
    this.dbProductTypesCache = []
    this.dbWatetMarkCache = null
    this.userInfo = null
    // ------运行任务时，该任务需要用到的变量，完成任务需要初始化 --e
    
  }

  async refreshTaskStatus () { // 更新任务排队状态，暂不实现 todo

  }

  async downloadZip (cosFileName) {
     const env = util.getConfig('default.env')
     let tmpPath = '' // 生成临时 zip 文件路径
     if (env === 'prod') {
      tmpPath = path.join(os.tmpdir(), `batch_${util.createUUID()}.zip`)
     } else {
      tmpPath = path.join(process.cwd(),`tmp/batch_${util.createUUID()}.zip`)
     }
     console.log(tmpPath, 'ttt')
    
    // 从 COS 下载 zip 到本地
    await cos.downloadFile(cosFileName, tmpPath)
    this.zipPath = tmpPath
  }

  async getLevelLimit() {
    const {level} = this.shopInfo
    const levelCfg = util.getConfig('album.levelCfg')
    for (const item of levelCfg) {
      if (item.level === level) return {...item}
    }
    return {...levelCfg[0]}
  }

  async readZipPath () {
    // 读取 zip 中央目录（不解压全部内容，仅获取文件列表）
    const directory = await unzipper.Open.file(this.zipPath)
    // 过滤隐藏文件（__MACOSX、.DS_Store 等），按类型分类
    for (const f of directory.files) {
      // 跳过隐藏文件
      if (f.path.startsWith('__MACOSX')) continue
      if (f.path === '.DS_Store' || f.path.endsWith('/.DS_Store')) continue
      if (f.path.startsWith('.')) continue
      if (f.type === 'Directory') continue

      if (/\.xlsx?$/i.test(f.path)) {
        this.excelFile.push({ path: f.path, entry: f })
      } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(f.path)) {
        const sizeInMB = Number(((f.uncompressedSize || 0) / (1024 * 1024)).toFixed(2))
        const {imgS} = await this.getLevelLimit()
        if (sizeInMB > imgS) continue // 过滤超限图片
        this.imageFiles.push({ path: f.path, entry: f, size: sizeInMB })
      }
    }
  }

  async readExcel () {
    if (!this.excelFile.length) {
      throw new Error('压缩包中未找到 Excel 文件')
    }
    // 只解压 Excel 文件到内存（通常几 MB，可接受）
    const excelBuffer = await this.excelFile[0].entry.buffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(excelBuffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new Error('Excel 文件中没有工作表')
    }

    const rows = []
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return // 跳过表头行
      const rowData = {}
      row.eachCell((cell, colIndex) => {
        rowData[`col${colIndex}`] = cell.value
      })
      rows.push({
        rowNum: rowIndex,       // Excel 行号，用于匹配图片文件名
        data: rowData,
      })
    })
    this.excelData = rows
  }

  async initTask () {
    const task = this.taskList.shift()
    this.runingList.push(task)
    await this.refreshTaskStatus()
    const {taskId, resolve, reject} = task
    let data = await dao.list('XaCache', {columns: {dataType: 40, key1: taskId}})
    data = data[0]
    const content = JSON.parse(data.content)
    content.status = 1
    content.waitingNum = 0
    await dao.update('XaCache', data.id, {content: JSON.stringify(content), upd_time: util.getNowTime()}) // 把任务状态开启
    const { cosFileName, shopId, userId } = content
    const sInfo = await dao.list('shop', {columns: {id: shopId}})
    this.shopInfo = sInfo[0]
    const userInfo = await dao.list('user', {columns: {id: userId}})
    this.userInfo = userInfo[0]
    this.shopId = shopId
    this.userId = userId
    this.taskId = taskId
    return {taskId, resolve, reject, cosFileName, shopId, userId}
  }

  async clear () {
    // 删除本地 zip 文件
    try {
      if (this.zipPath && fs.existsSync(this.zipPath)) {
        fs.unlinkSync(this.zipPath)
      }
    } catch (e) {
      console.error('清理 zip 文件失败:', e.message)
    }
    // 重置所有实例变量
    this.zipPath = ''
    this.excelFile = []
    this.imageFiles = []
    this.excelData = []
    this.products = []
    this.shopId = null
    this.userId = null
    this.taskId = null
    this.shopInfo = {}
    this.dbProductTypesCache = []
    this.dbWatetMarkCache = null
    this.userInfo = null
  }

  async formatProductInfo () {
    const ret = []
    for (const item of this.excelData) {
      const {rowNum, data} = item
      data.col1 = String(data.col1).trim()
      if (!data.col1) continue // 名称为空
      const imgs = []
      const descImgs = []
      const reg = new RegExp(`/${rowNum}_\\d+`) // 产品主图
      const descReg = new RegExp(`/${rowNum}_desc_\\d+`) // 产品详情图
      let {imgC, descImgC} = await this.getLevelLimit()
      for (const imgItem of this.imageFiles) {
        if (reg.test(imgItem.path)) {
          if (imgC <= 0) continue
          imgC -= 1
          imgs.push(imgItem)
        }
        if (descReg.test(imgItem.path)) {
          if (descImgC <= 0) continue
          descImgC -= 1
          descImgs.push(imgItem)
        }
      }
      if (!imgs.length) continue // 没有图片
      const dataItem = {
        url: imgs, descUrl: descImgs,
        desc: data.col1,
        productType: data.col2 ? String(data.col2).replace(/\s+/g, '') : '',
        specDetials: data.col3 ? String(data.col3).replace(/\s+/g, '') : '',
        price: data.col4 ? String(data.col4).replace(/\s+/g, '') : '',
        attr: data.col5 ? String(data.col5).replace(/\s+/g, '') : '',
        specs: data.col6 ? String(data.col6).replace(/\s+/g, '') : '' // 内部参数
      }
      ret.push(dataItem)
    }
    this.products = ret
    if (ret.length === 0) {
      throw new Error('无有效产品信息')
    }
  }

  // 获取剩余产品空间
  async getRestNums () {
    const countQueryBuild = await dao.createQueryBuilder('Product')
    countQueryBuild.select("COUNT(*)", "total");
    countQueryBuild.where('shopId = :shopId', {shopId: this.shopId})
    countQueryBuild.andWhere('(mode & 1) = 0')
    const result = await countQueryBuild.getRawOne();
    const count = Number(result.total || 0);
    const { limit } = util.vailCount(this.shopInfo, count)
    const ret = (limit - count) || 0
    return ret
  }


  async preHandle () {
    const restNums = await this.getRestNums()
    let data = await dao.list('XaCache', {columns: {dataType: 40, key1: this.taskId}})
    data = data[0]
    this.products = this.products.slice(0, restNums)
    const content = JSON.parse(data.content)
    content.totalNum = this.products.length
    await dao.update('XaCache', data.id, {content: JSON.stringify(content), upd_time: util.getNowTime()})
  }

  async formatProductType (productType) {
    let isMulType = 0
    let ret = []
    const typeList = productType.split('|')
    if (typeList.length > 1) isMulType = 1
    for (const typeItem of typeList) {
      let [type1, type2] = typeItem.split('/')
      type1 = type1 ? String(type1).replace(/\s+/g, '') : '';
      type2 = type2 ? String(type2).replace(/\s+/g, '') : '';
      if (!type1) continue  // 无效分类
      let dbProductTypes = this.dbProductTypesCache
      if (!dbProductTypes.length) {
        dbProductTypes = await dao.list('ProductTypes', {columns: {shopId: this.shopId}})
        this.dbProductTypesCache = dbProductTypes
      }
      let type1Id = ''
      let type2Id = ''
      for (const i of dbProductTypes) {
        if (i.name === type1 && i.parentId === 0) { // 有这个一级分类
          type1Id = i.id
          break
        }
      }
      if (!type1Id) { // 创建一级分类
        const {id} = await dao.create('ProductTypes', {shopId: this.shopId, name: type1, add_time: util.getNowTime()})
        type1Id = id
        dbProductTypes = await dao.list('ProductTypes', {columns: {shopId: this.shopId}})
        this.dbProductTypesCache = dbProductTypes
      }
      if (type2) {
        for (const i of dbProductTypes) {
          if (i.name === type2 && i.parentId === type1Id) {
            type2Id = i.id
            break
          }
        }
        if (!type2Id) {
          const {id} = await dao.create('ProductTypes', { shopId: this.shopId, name: type2, parentId: type1Id, add_time: util.getNowTime()})
          type2Id = id
          dbProductTypes = await dao.list('ProductTypes', {columns: {shopId: this.shopId}})
          this.dbProductTypesCache = dbProductTypes
        }
      }
      let str = `${type1Id}`
      if (type2Id) str = `${str}-${type2Id}`
      ret.push(str)
    }
    let retStr = ret.join(',')
    retStr = retStr ? `,${retStr},` : ''
    return {isMulType, productType: retStr}
  }

  async formatProductPrice(priceCfg, sepcCfg) {
    let isSpec = 0
    let price = ''
    let specDetials = { singleSpecs: [], mulSpecs: [], singleUseImg: 0, mulUseImg: 0, mulSpecPriceList: [] }

    const specList = parseSpec(sepcCfg)
    for (const item of specList) {
      const newItem = {name: item.name, useImg: 0, id: util.createUUID(), list: []}
      for (const childItem of item.val) {
        newItem.list.push({name: childItem, url: '', id: util.createUUID()})
      }
      specDetials.mulSpecs.push(newItem)
    }
    const lists = specDetials.mulSpecs.map((item) => item.list)
    const priceList = lists.reduce((acc, list) => {
      if (!acc.length) return list.map((item) => [item.id])
      const result = []
      for (const a of acc) {
        for (const b of list) {
          result.push([...a, b.id])
        }
      }
      return result
    }, [])
    specDetials.mulSpecPriceList = priceList.map((item) => {
      return {list: item, price: '', specStatus: 1, url: ''}
    })
    while(true) {
      price = priceCfg.replace(/\s+/g, '')
      if (!price) break
      if (priceReg.test(price)) { // 统一价格
        if (!specDetials.mulSpecs.length) break
        for (const item of specDetials.mulSpecPriceList) {
          item.price = price
        }
        break
      }
      // 下面是有规格的情况
      const tmpList = price.split('|')
      const priceList = []
      for (const item of tmpList) {
        const [a, p] = item.split(':')
        if (!a || !p) continue
        if (!priceReg.test(p)) continue // 不是合法的价格
        const keys = a.split(',')
        const ids = []
        for (const keyStr of keys) { // 这里是为了把中文转id
          for (const specItem of specDetials.mulSpecs) {
            let matched = false
            for (const listItem of specItem.list) {
              if (keyStr === listItem.name) {
                ids.push(listItem.id)
                matched = true
                break
              }
            }
            if (matched) break
          }
        }
        if (keys.length !== ids.length) continue // 有属性没对应，丢弃这条数据
        for (const specPriceItem of specDetials.mulSpecPriceList) {
          let matched = true
          for (const specId of ids) {
            if (specPriceItem.list.includes(specId)) continue
            matched = false
            break
          }
          if (matched) specPriceItem.price = p
        }
      }
      price = ''
      for (const specPriceItem of specDetials.mulSpecPriceList) {
        if (!specPriceItem.price) continue
        if (!price) {
          price = specPriceItem.price
          continue
        }
        if (Number(specPriceItem.price) >= Number(price)) continue
        price = specPriceItem.price // 找到最低价
      }
      break
    }
    specDetials = specDetials.mulSpecs.length ? JSON.stringify(specDetials): ''
    isSpec = specDetials ? 2 : 0
    return {isSpec, price, specDetials}
  }

  async formatAttr(rawAttr) {
    if (!rawAttr) return '[]'
    const list = parseSpec(rawAttr)
    const ret = []
    for (const item of list) {
      ret.push({name: item.name, val: item.val[0], customOpts: []})
    }
    return JSON.stringify(ret)
  }
  
  async formatSpecs (rawSpecs) {
    if (!rawSpecs) return '[]'
    const list = parseSpec(rawSpecs)
    const ret = []
    for (const item of list) {
      ret.push({key: item.name, value: item.val[0], _id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })
    }
    return JSON.stringify(ret)
  }

  async getWtCfg() {
    if (this.shopInfo.waterMark !== 1) return null
    let wtCfg = this.dbWatetMarkCache
    if (!wtCfg) {
      let ret = await dao.list('WatermarkCfg', {columns: {shopId: this.shopId}})
      if (ret.length) this.dbWatetMarkCache = ret[0]
      wtCfg = this.dbWatetMarkCache
    }
    if (!wtCfg) return null
    const content = JSON.parse(wtCfg.cfg)
    const { batch, degree, dissolve, fontsize, gravity, image, textUrl } = content
    let ret = ''
    let imgUrl = ''
    if (wtCfg.type === 1) { // 图片水印
      if (!image) return ret
      imgUrl = `http:${image}`
    }
    if (wtCfg.type === 2) { //文字水印
      if (!textUrl) return ret
      imgUrl = `http:${textUrl}`
    }
    const imgUrlBase64 = COS.util.encodeBase64(imgUrl, true);
    ret = `watermark/1/image/${imgUrlBase64}/gravity/${gravity}/dissolve/${dissolve}/scatype/1/spcent/${fontsize *  10}/dx/20/dy/20/blogo/1`;
    if (batch) {
      ret += `/batch/1/degree/${degree || 0}`
    }
    return ret
  }
  
  async formatImgs(rawUrl) {
    const contentValid = require(path.join(process.cwd(),"modules/contentValid"));
    if (!rawUrl || !rawUrl.length) return ''
    const waterCfg = await this.getWtCfg() // 水印配置（暂留，后续加水印处理
    let uploadRule = 'imageMogr2/format/jpg/auto-orient'
    if (waterCfg) uploadRule = `${uploadRule}|${waterCfg}`

    const limiter = new util.SmartLimiter({ maxConcurrent: 5 })
    const uploadTasks = rawUrl.map((imgItem) => {
      return limiter.run(async () => {
        // 1. 从 zip 解压单张图片到内存
        let buffer = await imgItem.entry.buffer()
        try {
          // 2. MD5 计算
          const md5 = crypto.createHash('md5').update(buffer).digest('hex')
          let preKey = `${this.shopId}_${this.userId}`
          // preKey = `${this.shopId}_${this.userId}_test` // 测试专用
          if (waterCfg) preKey = `${preKey}_${Math.floor(Math.random() * 1000)}`
          const cosKey = `${preKey}_${md5}.jpg`

          // 3. 上传到 COS（配置图片处理规则：转 jpg + 自动旋转）
          const uploadRet = await new Promise((resolve, reject) => {
            // resolve(`https://${cosKey}`)
            // return
            cos.cosInstance.putObject({
              Bucket: cos.cfg.bucket,
              Region: cos.cfg.region,
              Key: cosKey, Body: buffer,
              Headers: {
                'Pic-Operations': JSON.stringify({ is_pic_info: 1, rules: [ { rule: uploadRule, fileid: cosKey }] })
              }
            }, (err, data) => {
              if (err) reject(err)
              else resolve({url: `//${data.Location}`, fileName: cosKey})
            })
          })
          // 此处执行图片审核
          const {url, fileName} = uploadRet
          const imgCheckRet = await contentValid.albumValidImg({fileName, shopId: this.shopId, userInfo: this.userInfo})
          if (imgCheckRet !== 0) { // 校验没通过
            return {pass: false, url}
          }
          return {pass: true, url}
        } finally {
          // 4. 释放内存（置 null 帮助 GC 回收）
          buffer = null
        }
      })
    })

    const results = await Promise.allSettled(uploadTasks)

    const retUrls = []
    for (const item of results) {
      if (item.status !== 'fulfilled') continue
      if (item.value.pass !== true) throw new Error(`图片校验没通过: ${item.value.url}`)
      retUrls.push(item.value.url)
    }
    const ret = retUrls.join(',')
    return ret
  }

  async textCheck(payload) {
    const contentValid = require(path.join(process.cwd(),"modules/contentValid"));
    const {desc, specDetials, price, attr, specs} = payload
    const strList = util.joinStrArrayWithLimit([desc, specDetials, price, attr, specs], 2000)
    const pList = strList.map((str) => {
      return contentValid.albumValidText({openid: this.userInfo.openid, userId: this.userId, shopId: this.shopId, content: str, type: 0})
    })
    const validRes = await Promise.allSettled(pList)
    for (const item of validRes) {
      if (item.status !== 'fulfilled') throw new Error(`文本校验出错: desc：${desc}`)
      if (item.value.pass !== true) throw new Error(`文本校验未通过: desc:：${desc}`)
    }
  }
  
  async toUploadProd () {
    for (const rawInfo of this.products) {
      const prodInfo = {}
      prodInfo.desc = rawInfo.desc
      const productTypeRet = await this.formatProductType(rawInfo.productType)
      prodInfo.isMulType = productTypeRet.isMulType
      prodInfo.productType = productTypeRet.productType
      const priceRet = await this.formatProductPrice(rawInfo.price, rawInfo.specDetials)
      prodInfo.price = priceRet.price
      prodInfo.isSpec = priceRet.isSpec
      prodInfo.specDetials = priceRet.specDetials
      prodInfo.attr = await this.formatAttr(rawInfo.attr)
      prodInfo.specs = await this.formatSpecs(rawInfo.specs)
      // 此处执行文本校验，校验通过后才传图片
      await this.textCheck(prodInfo)
      prodInfo.url = await this.formatImgs(rawInfo.url)
      if (!prodInfo.url) continue // 没有图片成功上传，丢弃这条数据
      prodInfo.descUrl = await this.formatImgs(rawInfo.descUrl)
      prodInfo.id = 0
      prodInfo.shopId = this.shopId

      let maxPos = 0
      const query = await dao.createQueryBuilder('Product', 'Product');
      query.select(['Product.id', 'Product.pos']);
      query.where('shopId = :shopId', { shopId: this.shopId });
      query.andWhere('(mode & 1) = 0')
      query.orderBy('pos', 'DESC')
      query.take(1);
      const res = await query.getMany();
      if (res.length === 1) maxPos = res[0].pos
      await dao.create('Product', {...prodInfo, add_time: util.getNowTime(), pos: maxPos + 10000}) // 写db
      let data = await dao.list('XaCache', {columns: {dataType: 40, key1: this.taskId}}) // 更新任务数据
      data = data[0]
      const content = JSON.parse(data.content)
      content.finishedNum = content.finishedNum + 1
      await dao.update('XaCache', data.id, {content: JSON.stringify(content), upd_time: util.getNowTime()})
    }

  }
  
  async start () {
    if (this.runingList.length) return
    if (this.taskList.length === 0) return
    const {resolve, reject, cosFileName} = await this.initTask() // 初始化任务
    try {
      await this.downloadZip(cosFileName) // 下载 zip 文件
      await this.readZipPath() // 读取 zip 目录
      await this.readExcel() // 读取excel 文件
      await this.formatProductInfo() // 初步处理产品信息
      await this.preHandle() // 预处理，这里对数量限制做处理，
      await this.toUploadProd() // 开始上传

      let data = await dao.list('XaCache', {columns: {dataType: 40, key1: this.taskId}})
      data = data[0]
      const content = JSON.parse(data.content)
      content.status = 2
      await dao.update('XaCache', data.id, {content: JSON.stringify(content), upd_time: util.getNowTime()})

    } catch(e) {
      console.log(e)
      let data = await dao.list('XaCache', {columns: {dataType: 40, key1: this.taskId}})
      data = data[0]
      const content = JSON.parse(data.content)
      content.status = 3
      content.msg = e.message || '未知错误'
      await dao.update('XaCache', data.id, {content: JSON.stringify(content), upd_time: util.getNowTime()})
    } finally {
      await this.clear()
      resolve()
      this.runingList = []
      this.start()
    }
  }

  async run(payload) { // 外部调用
    const {taskId, cosFileName, shopId, userId} = payload
    let data = await dao.list('XaCache', {columns: {dataType: 40, key1: taskId}})
    if (data.length !== 1) {
      await dao.create('XaCache', {dataType: 41, add_time: util.getNowTime(), content: JSON.stringify({ ...payload })})
      return // 任务不存在
    }
    data = data[0]
    const content = JSON.parse(data.content)
    if (![0,4].includes(content.status)) { // 重复执行
      await dao.create('XaCache', {dataType: 42, add_time: util.getNowTime(), content: JSON.stringify({ ...payload })})
      return
    }
    
    let resolve = null;
    let reject = null;
    const p = new Promise((a,b) => {
      resolve = a;
      reject = b;
    })
    let runningNums = this.taskList.length
    runningNums += this.runingList.length
    if (runningNums > 0) { // 需要排队
      content.waitingNum = runningNums
      content.status = 4
      await dao.update('XaCache', data.id, {content: JSON.stringify(content), upd_time: util.getNowTime()})
    }
    this.taskList.push({taskId, cosFileName, shopId, userId, resolve, reject})
    this.start()
    return p
  }
  
  async addTask (payload) { // 外部调用
    const taskId = util.createUUID()
    await dao.create('XaCache', {dataType: 40, add_time: util.getNowTime(), content: JSON.stringify({
      ...payload, totalNum: 0, finishedNum: 0, failNum: 0, 
      status: 0, // 0-待开始、1-进行中、2-任务结束、3-任务中断、4-排队中
      waitingNum: 0, // 前面排队任务数
    }), key1: taskId})
    return taskId
  }
}

module.exports.processBatchUploadInstance = new ProcessBatchUpload()