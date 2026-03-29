// let current = 6; // 二进制 0110
// let mask = 1 << 1; // 二进制 0010

// // 抹除 1 << 1 这一位
// let result = current & ~mask;

const path = require("path");
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

/**
 * 统计 nouse 备份文件数量及体积
 * @param {Object} params - 配置对象
 * @param {Number|String} params.id - (可选) 商家ID，不传则统计全桶所有 nouse 文件
 */
module.exports.countNouseFiles = async ({ id } = {}) => {
  const { cosInstance, cfg } = cos;
  
  // 如果传了 id，前缀就是 nouse_ID_，否则统计所有 nouse_
  const prefix = id ? `nouse_${id}_` : `nouse_`;
  
  let totalCount = 0;
  let totalSizeByte = 0;
  let marker = '';
  let isTruncated = true;
  let requestCount = 0;

  console.log(`\n📊 开始统计 COS 备份文件...`);
  console.log(`   🔎 扫描前缀: "${prefix}"`);

  try {
    while (isTruncated) {
      requestCount++;
      const res = await cosInstance.getBucket({
        Bucket: cfg.bucket,
        Region: cfg.region,
        Prefix: prefix,
        Marker: marker,
        MaxKeys: '1000'
      });

      if (res.Contents && res.Contents.length > 0) {
        totalCount += res.Contents.length;
        // 累加文件大小
        for (const file of res.Contents) {
          totalSizeByte += parseInt(file.Size || 0);
        }
      }

      // 实时打印扫描进度（每 1000 个跳一次，避免刷屏）
      process.stdout.write(`\r      已扫描文件数: ${totalCount} ... `);

      isTruncated = res.IsTruncated === 'true' || res.IsTruncated === true;
      marker = res.NextMarker;
    }

    const totalSizeMB = (totalSizeByte / 1024 / 1024).toFixed(2);
    const totalSizeGB = (totalSizeByte / 1024 / 1024 / 1024).toFixed(3);

    console.log(`\n\n===========================================`);
    console.log(`📈 统计报告 [${id ? '商家 ' + id : '全桶汇总'}]`);
    console.log(`-------------------------------------------`);
    console.log(`   - 备份文件总数: ${totalCount} 个`);
    console.log(`   - 累计占用空间: ${totalSizeMB} MB (${totalSizeGB} GB)`);
    console.log(`   - API 请求次数: ${requestCount} 次`);
    console.log(`===========================================\n`);

    return { totalCount, totalSizeByte };
    
  } catch (err) {
    console.error(`\n❌ 统计过程出错: ${err.message}`);
  }
};


/**
 * 还原 COS 垃圾图片插件 (恢复模式)
 * @param {Object} params - 配置对象
 * @param {Number|Array|Object} params.id - 商家ID：支持数字、数组或范围
 * @param {Boolean} params.isExec - 是否正式执行还原：true 则执行，false 仅预览
 * @param {Number} params.concurrency - 并发数，默认 10
 */
module.exports.restoreImgs = async ({ 
  id, 
  isExec = false, 
  concurrency = 5 
}) => {
  if (!id) {
    console.error('❌ 未传入 id 参数');
    return;
  }

  // 1. 参数解析
  let targetShopIds = [];
  if (typeof id === 'number' || typeof id === 'string') {
    targetShopIds.push(Number(id));
  } else if (Array.isArray(id)) {
    targetShopIds = id;
  } else if (typeof id === 'object' && id.start !== undefined && id.end !== undefined) {
    for (let i = id.start; i <= id.end; i++) {
      targetShopIds.push(i);
    }
  }

  const { cosInstance, cfg } = cos;
  let globalTotalRestored = 0;

  // 2. 内部方法：获取所有已标记为 nouse_ 的文件
  const getNouseFiles = async (shopId) => {
    let allFiles = []; let marker = ''; let isTruncated = true;
    while (isTruncated) {
      const res = await cosInstance.getBucket({
        Bucket: cfg.bucket,
        Region: cfg.region,
        Prefix: `nouse_${shopId}_`, // 只找被清理掉的
        Marker: marker,
        MaxKeys: '1000'
      });
      if (res.Contents) allFiles = allFiles.concat(res.Contents);
      isTruncated = res.IsTruncated === 'true' || res.IsTruncated === true;
      marker = res.NextMarker;
    }
    return allFiles;
  };

  /**
   * 执行单条还原：nouse_A.jpg -> A.jpg
   */
  const doRestore = async (nouseKey, current, total) => {
    const originalKey = nouseKey.replace(/^nouse_/, '');
    const CopySource = `${cfg.bucket}.cos.${cfg.region}.myqcloud.com/${nouseKey}`;
    
    try {
      // 1. 复制回原名
      await cosInstance.sliceCopyFile({
        Bucket: cfg.bucket, Region: cfg.region, Key: originalKey, CopySource,
      });
      // 2. 删除 nouse_ 备份
      await cosInstance.deleteObject({ Bucket: cfg.bucket, Region: cfg.region, Key: nouseKey });
      
      process.stdout.write(`\r      ♻️ 正在还原: [${current}/${total}] ... `);
      return true;
    } catch (e) {
      console.log(`\n      ❌ 还原失败 [${nouseKey}]: ${e.message}`);
      return false;
    }
  };

  // 3. 执行流程
  const modeName = isExec ? "🛠️ 正式还原模式" : "🔍 还原预览模式";
  console.log(`\n===========================================`);
  console.log(`${modeName}`);
  console.log(`目标商家数: ${targetShopIds.length} | 并发数: ${concurrency}`);
  console.log(`===========================================\n`);

  for (const shopId of targetShopIds) {
    try {
      const nouseFiles = await getNouseFiles(shopId);
      
      console.log(`[Shop ${shopId}] 发现可还原文件: ${nouseFiles.length} 个`);

      if (nouseFiles.length > 0 && isExec) {
        // 分批并发处理
        for (let i = 0; i < nouseFiles.length; i += concurrency) {
          const chunk = nouseFiles.slice(i, i + concurrency);
          await Promise.all(chunk.map((file, index) => {
            return doRestore(file.Key, i + index + 1, nouseFiles.length);
          }));
          globalTotalRestored += chunk.length;
        }
        console.log(` ✅ 还原完成`);
      }
    } catch (err) {
      console.error(`❌ [Shop ${shopId}] 还原过程出错: ${err.message}`);
    }
  }

  console.log(`\n===========================================`);
  console.log(`✨ 还原任务结束！累计还原文件: ${globalTotalRestored}`);
  if (!isExec) console.log(`ℹ️ 当前为预览模式，未实际操作。`);
  console.log(`===========================================\n`);
};


// Feedback.url
// Product.url
// Product.descUrl
// Product.specDetials
// Shop.url
// Shop.bannerCfg
// Shop.specsCfg
// Shop.homePageCfg
// Shop.qrcodeUrl
// WatermarkCfg.previewUrl
// WatermarkCfg.cfg
// WatermarkCfg.configkey
// 大户：20、25、50、88、173、175、176、179、518、532、1074、1094、1158、1201

/**
 * 清理 COS 垃圾图片插件 (并发控制版)
 * @param {Object} params - 配置对象
 * @param {Number|Array|Object} params.id - 商家ID
 * @param {Boolean} params.isExec - 是否正式清理
 * @param {Boolean} params.showDetails - 是否列出详情
 * @param {Number} params.bufferHour - 安全缓冲时间(小时)
 * @param {Number} params.concurrency - 并发数，默认 10
 */
module.exports.clearImgs = async ({ 
  id, 
  isExec = false, 
  showDetails = false, 
  bufferHour = 1,
  concurrency = 5
}) => {
  if (!id) {
    console.error('❌ 未传入 id 参数，终止执行');
    return;
  }
  const env = util.getConfig('default.env')
  if (env !== 'test') {
    console.error('❌ 请连接正式db，终止执行');
    return;
  }

  // 1. 参数解析
  let targetShopIds = [];
  if (typeof id === 'number' || typeof id === 'string') {
    targetShopIds.push(Number(id));
  } else if (Array.isArray(id)) {
    targetShopIds = id;
  } else if (typeof id === 'object' && id.start !== undefined && id.end !== undefined) {
    for (let i = id.start; i <= id.end; i++) {
      targetShopIds.push(i);
    }
  }

  let globalTotalScanned = 0;
  let globalTotalTrash = 0;
  let globalTotalSize = 0;
  let globalProcessedCount = 0;

  const { cosInstance, cfg } = cos;
  const BUFFER_TIME_MS = bufferHour * 60 * 60 * 1000;
  const NOW = Date.now();

  // 2. 内部方法
  const getUsedImageListFromDB = async (shopId) => {
    const strList = [
      'upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_3_dda7b2170dac6b8a161f072b4b6a62b9.jpg',
      'upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_3_f0fb6556d51a4f1da626a6d92064ac1c.png',
      'upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_3_19a302d6f831268825df5f881abf9b95.png',
      'upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_3_24fd435bee5b919a4c0db50415bf6b97.png'
    ];
    const addData = (list, k) => {
      if (!list) return;
      for (const item of list) { if (item[k]) strList.push(item[k]); }
    };
    let ret = await dao.list('Feedback'); addData(ret, 'url');
    ret = await dao.list('Product', { columns: { shopId } }); addData(ret, 'url'); addData(ret, 'descUrl'); addData(ret, 'specDetials');
    ret = await dao.list('Shop', { columns: { id: shopId } }); addData(ret, 'url'); addData(ret, 'bannerCfg'); addData(ret, 'specsCfg'); addData(ret, 'homePageCfg'); addData(ret, 'qrcodeUrl');
    ret = await dao.list('WatermarkCfg', { columns: { shopId } }); addData(ret, 'previewUrl'); addData(ret, 'cfg'); addData(ret, 'configkey');
    return strList;
  };

  const getAllCosFiles = async (shopId) => {
    let allFiles = []; let marker = ''; let isTruncated = true;
    while (isTruncated) {
      const res = await cosInstance.getBucket({
        Bucket: cfg.bucket, Region: cfg.region, Prefix: `${shopId}_`, Marker: marker, MaxKeys: '1000'
      });
      if (res.Contents && res.Contents.length > 0) {
        const filtered = res.Contents.filter(file => {
          const mTime = new Date(file.LastModified).getTime();
          return mTime < (NOW - BUFFER_TIME_MS);
        });
        allFiles = allFiles.concat(filtered);
      }
      isTruncated = res.IsTruncated === 'true' || res.IsTruncated === true;
      marker = res.NextMarker;
    }
    return allFiles;
  };

  /**
   * 备份并删除单个文件
   */
  const backupAndDelete = async (key, current, total) => {
    const CopySource = `${cfg.bucket}.cos.${cfg.region}.myqcloud.com/${key}`;
    try {
      await cosInstance.sliceCopyFile({
        Bucket: cfg.bucket, Region: cfg.region, Key: `nouse_${key}`, CopySource,
      });
      await cosInstance.deleteObject({ Bucket: cfg.bucket, Region: cfg.region, Key: key });
      // 并发模式下使用 \r 刷新同一行进度，避免刷屏
      process.stdout.write(`\r      🚀 正在执行清理: [${current}/${total}] ... `);
      return true;
    } catch (e) {
      console.log(`\n      ❌ 失败 [${key}]: ${e.message}`);
      return false;
    }
  };

  // 3. 执行流程
  const modeName = isExec ? "🔥 正式清理模式" : "🔍 预览统计模式";
  console.log(`\n===========================================`);
  console.log(`${modeName}`);
  console.log(`商家总数: ${targetShopIds.length} | 并发数: ${concurrency} | 缓冲: ${bufferHour}h`);
  console.log(`===========================================\n`);

  for (const shopId of targetShopIds) {
    if (shopId === 5) continue
    try {
      const [usedList, allFiles] = await Promise.all([
        getUsedImageListFromDB(shopId),
        getAllCosFiles(shopId)
      ]);

      const trashFiles = [];
      let currentShopTrashSize = 0;

      for (const file of allFiles) {
        const isUsed = usedList.some(str => str.includes(file.Key));
        if (!isUsed && !file.Key.startsWith('nouse_')) {
          trashFiles.push(file);
          currentShopTrashSize += parseInt(file.Size || 0);
        }
      }

      globalTotalScanned += allFiles.length;
      globalTotalTrash += trashFiles.length;
      globalTotalSize += currentShopTrashSize;

      const sizeMB = (currentShopTrashSize / 1024 / 1024).toFixed(2);
      console.log(`[Shop ${shopId}] 扫描文件: ${allFiles.length} | 发现垃圾: ${trashFiles.length} 张 (${sizeMB} MB)`);

      if (trashFiles.length > 0) {
        if (showDetails && !isExec) {
          trashFiles.forEach(f => console.log(`   └─ 待删: ${f.Key} (${(f.Size/1024).toFixed(1)}KB)`));
        }

        if (isExec) {
          // --- 并发处理核心逻辑 ---
          for (let i = 0; i < trashFiles.length; i += concurrency) {
            const chunk = trashFiles.slice(i, i + concurrency);
            await Promise.all(chunk.map((file, index) => {
              const currentCount = i + index + 1;
              return backupAndDelete(file.Key, currentCount, trashFiles.length);
            }));
            globalProcessedCount += chunk.length;
          }
          console.log(` ✅ 完成`);
        }
      }
    } catch (err) {
      console.error(`❌ [Shop ${shopId}] 发生错误: ${err.message}`);
    }
  }

  // 4. 汇总报告
  const totalSizeMB = (globalTotalSize / 1024 / 1024).toFixed(2);
  console.log(`\n===========================================`);
  console.log(`✨ 任务完成！`);
  console.log(`📊 汇总报告：`);
  console.log(`   - 扫描商家: ${targetShopIds.length}`);
  console.log(`   - 扫描文件: ${globalTotalScanned}`);
  console.log(`   - 垃圾总数: ${globalTotalTrash}`);
  console.log(`   - 释放空间: ${totalSizeMB} MB`);
  if (isExec) console.log(`   - 成功处理: ${globalProcessedCount}`);
  console.log(`===========================================\n`);
};


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

// 根据 shopId 插入指定数量的产品
module.exports.createProducts = async (shopId, count) => {
  const imageUrl = '//upload-1259129443.cos.ap-guangzhou.myqcloud.com/5_e07dd185b9d5880b942a468705f14329.jpg'
  const currentTime = util.getNowTime()
  
  for (let i = 1; i <= count; i++) {
    const product = {
      shopId: shopId, name: `产品${i}`, url: imageUrl, price: '100', isSpec: 0, productType: '', isMulType: 0,
      desc: `产品${i}的描述`, status: 0, sort: 0, pos: 0, add_time: currentTime, upd_time: currentTime,
    }
    await dao.create('Product', product)
  }
  console.log(`已为 shop id=${shopId} 插入 ${count} 个产品`)
}


// 根据 shopId 将该店铺所有产品的 mode 改为 0
module.exports.resetProductMode = async (shopId) => {
  const shopIds = Array.isArray(shopId) ? shopId : [shopId]
  let totalUpdated = 0
  
  for (const id of shopIds) {
    let shopInfo = await dao.list('Shop', {columns: {id}, only: ['id', 'mode']})
    shopInfo =  shopInfo[0]
    let mode = shopInfo.mode
    mode = mode & ~1<<0
    await dao.update('Shop', id, {mode})

    const products = await dao.list('Product', {columns: {shopId: id, mode: 1}, only: ['id']})
    if (products.length === 0) {
      console.log(`Shop ${id}: 没有 mode 为 1 的产品`)
      continue
    }
    const idsToUpdate = products.map(p => p.id)
    await dao.update('Product', idsToUpdate, {mode: 0})
    console.log(`Shop ${id}: 已将 ${products.length} 个产品的 mode 重置为 0`)
    totalUpdated += products.length
  }
  
  console.log(`总计: 已将 ${totalUpdated} 个产品的 mode 重置为 0`)
}



const getExpiredShop = async (expiredDays) =>{
  const now = util.getNowTime()
  const expiredTimeThreshold = now - (expiredDays * 24 * 3600)
  
  const queryBuild = await dao.createQueryBuilder('Shop')
  queryBuild.select(['Shop.id', 'Shop.level', 'Shop.expiredTime','Shop.status', 'Shop.auditing', 'Shop.add_time', 'Shop.mode'])
  queryBuild.where('1 = 1')
  queryBuild.andWhere('Shop.level > 0')
  queryBuild.andWhere('(Shop.mode & 1) = 0')
  queryBuild.andWhere('Shop.expiredTime <= :a', {a: expiredTimeThreshold})
  queryBuild.limit(50)
  const data = await queryBuild.getMany()
  const ret = data.map(item => ({
    ...item,
    expiredTimeStr: util.dateTs2Str(item.expiredTime, 'YYYY-MM-DD HH:mm:ss'),
    expiredDays: Math.floor((now - item.expiredTime) / (24 * 3600))
  }))
  return ret
}

const handleExpiredProd = async (shopList) => {
    // 根据 Shop.id 取出对应的 Product
  for (const shopItem of shopList) {
    const products = await dao.list('Product', {columns: {shopId: shopItem.id}})
    // 前50个保持不变，后面的把 mode 字段改为1
    if (products.length > 50) {
      const productsToUpdate = products.slice(50)
      const idsToUpdate = productsToUpdate.map(p => p.id)
      await dao.update('Product', idsToUpdate, {mode: 1})
      console.log(`Shop ${shopItem.id}: 已更新 ${productsToUpdate.length} 个产品的 mode 为 1`)
    }
    let mode = shopItem.mode
    mode = mode | 1<<0
    await dao.update('Shop', shopItem.id, {mode})
  }
}

module.exports.vipExpiredHandle = async (expiredDays = 0) => {
  const shopList = await getExpiredShop(expiredDays) // 取出过期店铺
  console.log(shopList)
  // await handleExpiredProd(shopList) // 软删除产品
}


const init = async () => {
  setTimeout(() => {
    // this.clearImgs({ showDetails: false, id: {start: 2300, end: 2400}, isExec: false }) // 清理图片
    // this.countNouseFiles()  // 统计多少垃圾图片
    // this.restoreImgs({id: 11}) // 还原图片
    // this.vipExpiredHandle(5) // 处理过期会员
    // this.resetProductMode(5) // 把产品mode 置 0
  }, 0);
}

init()
