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
const fs = require('fs');


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


// 根据 shopId 将该店铺所有产品的 mode 改为 0，即恢复产品
module.exports.resetProductMode = async (shopId) => {
  const shopIds = Array.isArray(shopId) ? shopId : [shopId]
  let totalUpdated = 0
  
  for (const id of shopIds) {
    await dao.update('Shop', id, {mode: 0})

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

/**
 * 整合后的 VIP 过期处理方法
 * 包含：自动查询过期店铺、打印日志、超额产品处理、店铺状态更新
 * @param {number} expiredDays 过期天数阈值（例如过期 7 天后执行处理）
 * @param {boolean} isDel 是否执行产品下架(mode 改为 1)
 */
module.exports.vipExpiredHandle = async (expiredDays, isDel = false) => {
  const now = util.getNowTime();
  const expiredTimeThreshold = now - (expiredDays * 24 * 3600);
  
  // 1. 直接在此处查询过期店铺（限制每次处理 50 条，防止内存溢出）
  const queryBuild = await dao.createQueryBuilder('Shop');
  queryBuild.select(['Shop.id', 'Shop.level', 'Shop.expiredTime', 'Shop.status', 'Shop.mode']);
  queryBuild.where('Shop.level > 0'); // 必须是会员
  queryBuild.andWhere('Shop.mode = 0'); // 位运算：第0位为0（表示尚未处理过过期）
  queryBuild.andWhere('Shop.expiredTime <= :a', { a: expiredTimeThreshold });
  queryBuild.limit(50);
  
  const shopList = await queryBuild.getMany();

  if (shopList.length === 0) {
    console.log(`[VIP过期处理] 未发现需处理的过期店铺 (阈值: ${expiredDays}天)`);
    return;
  }

  // 2. 打印待处理店铺清单
  console.log(`[VIP过期处理] 准备处理以下 ${shopList.length} 个店铺:`);
  shopList.forEach(s => {
    const timeStr = util.dateTs2Str(s.expiredTime, 'YYYY-MM-DD HH:mm:ss');
    const overDays = Math.floor((now - s.expiredTime) / (24 * 3600));
    console.log(`- ShopID: ${s.id}, 过期时间: ${timeStr}, 已过期: ${overDays}天`);
  });

  // 3. 遍历处理逻辑
  for (const shopItem of shopList) {
    const shopId = shopItem.id;

    // A. 处理超额产品 (isDel 为 true 时执行)
    if (isDel) {
      const products = await dao.list('Product', { columns: { shopId } });
      // 策略：保留前50个，剩下的 mode 改为 1 (下架状态)
      if (products.length > 50) {
        const idsToUpdate = products.slice(50).map(p => p.id);
        await dao.update('Product', idsToUpdate, { mode: 1 });
        console.log(`Shop ${shopId}: 已更新 ${idsToUpdate.length} 个超额产品的 mode 为 1`);
      }
      // B. 更新店铺自身的 mode 标识位 1
      const newMode = 1;
      await dao.update('Shop', shopId, { mode: newMode });
      console.log(`Shop ${shopId}: 店铺 mode 已更新为 ${newMode} (已标记过期处理)`);
    }
  }
};

/**
 * 生成业务统计报表 (弹窗详情倒序 + 全功能版)
 */
module.exports.handleLogsToHtml = async (days = 7) => {
  const nowTs = Math.floor(Date.now() / 1000); 
  console.log(`\n🚀 [开始] 正在生成最近 ${days} 天的业务深度报表...`);

  // --- 1. 数据库查询阶段 ---
  process.stdout.write('📡 [1/4] 提取数据...');
  const logs = await dao.createQueryBuilder('CusLogs', 'CusLogs');
  logs.select(['CusLogs.id', 'CusLogs.content', 'CusLogs.add_time']);
  logs.where('logType = 4');
  logs.orderBy('add_time', 'DESC');
  logs.limit(days); 
  const logsData = await logs.getMany();
  process.stdout.write(' 完成 ✅\n');

  if (logsData.length === 0) return;

  // --- 2. 数据处理阶段 ---
  const shopCacheMap = new Map(); 
  const processedData = [];
  const shopHistoryMap = {}; 

  for (let i = 0; i < logsData.length; i++) {
    const item = logsData[i];
    let shopDataMap = {};
    try { shopDataMap = JSON.parse(item.content); } catch (e) { continue; }
    const allShopIds = Object.keys(shopDataMap).map(id => parseInt(id));

    const missingIds = allShopIds.filter(id => !shopCacheMap.has(id));
    if (missingIds.length > 0) {
      const qb = await dao.createQueryBuilder('Shop', 'Shop');
      qb.select(['Shop.id', 'Shop.name', 'Shop.level', 'Shop.expiredTime']); 
      qb.where('Shop.id IN (:...ids)', { ids: missingIds });
      const newShops = await qb.getMany();
      newShops.forEach(info => {
        shopCacheMap.set(info.id, {
          id: info.id,
          name: info.name,
          level: info.level,
          expiredTime: info.expiredTime || 0,
          expiredDate: info.expiredTime ? util.dateTs2Str(info.expiredTime, 'YYYY-MM-DD') : '-'
        });
      });
      missingIds.forEach(id => {
        if (!shopCacheMap.has(id)) shopCacheMap.set(id, { name: '未知店铺', id, level: 0, expiredTime: 0, expiredDate: '-' });
      });
    }

    const logDate = util.dateTs2Str(item.add_time, 'YYYY-MM-DD');
    let tA = { m: 0, v: 0 }, tC = { m: 0, v: 0 };
    let vShopCount = 0, nShopCount = 0; 
    
    const dayShops = Object.entries(shopDataMap).map(([id, val]) => {
      const sId = parseInt(id);
      const info = shopCacheMap.get(sId);
      if (!shopHistoryMap[sId]) shopHistoryMap[sId] = { ...info, logs: [] };
      // 存储日志
      shopHistoryMap[sId].logs.push({ date: logDate, admin: val.admin || {}, custom: val.custom || {} });
      
      if (info.level > 0) vShopCount++; else nShopCount++;
      tA.m += (val.admin?.member || 0); tA.v += (val.admin?.viewDetial || 0);
      tC.m += (val.custom?.member || 0); tC.v += (val.custom?.viewDetial || 0);
      return { ...val, ...info }; 
    }).sort((a, b) => (b.custom?.member || 0) - (a.custom?.member || 0));

    processedData.push({ logId: item.id, logDate, total: { tA, tC, vShopCount, nShopCount }, shops: dayShops });
  }

  // --- 3. HTML 渲染阶段 ---
  const generateHtml = (data, history, dayRange, currentTs) => {
    const safeJson = (obj) => JSON.stringify(obj).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>小果图册 经营深度报表</title>
    <style>
      body { font-family: -apple-system, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; color: #333; }
      .container { max-width: 1250px; margin: 0 auto; background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
      h1 { text-align: center; color: #1989fa; font-size: 18px; margin-bottom: 20px; }
      
      .search-bar { display: flex; gap: 8px; margin-bottom: 25px; justify-content: center; }
      .search-input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; width: 220px; outline: none; }
      .search-btn { background: #1989fa; color: #fff; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }

      .tag { font-size: 11px; padding: 3px 8px; border-radius: 4px; background: #f0f0f0; color: #666; border-left: 3px solid #ccc; white-space: nowrap; }
      .tag b { color: #000; }
      .tag-admin { border-left-color: #1989fa; color: #1989fa; background: #e6f7ff; }
      .tag-client { border-left-color: #52c41a; color: #52c41a; background: #f6ffed; }

      .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: bold; }
      .badge-vip { background: #fff7e6; color: #e67e22; border: 1px solid #ffbb96; }
      .badge-warning { background: #fff1f0; color: #ff4d4f; border: 1px solid #ffa39e; }
      .badge-expired { background: #f5f5f5; color: #8c8c8c; border: 1px solid #d9d9d9; }

      details { border: 1px solid #eee; border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
      summary { padding: 12px; cursor: pointer; background: #fafafa; display: flex; gap: 8px; align-items: center; font-size: 12px; }
      
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border: 1px solid #ebeef5; text-align: left; font-size: 13px; }
      .shop-row:hover { background: #f9f9f9; cursor: pointer; }
      
      .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000; justify-content: center; align-items: center; backdrop-filter: blur(2px); }
      .modal-content { background: #fff; width: 85%; max-height: 85vh; border-radius: 12px; overflow-y: auto; padding: 25px; }
      .stat-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0 25px 0; }
      .stat-card { background: #f8f9fa; padding: 12px; border-radius: 8px; border-left: 4px solid #ddd; }
    </style>
    </head><body>
      <div class="container">
        <h1>小果图册 业务深度统计</h1>
        
        <div class="search-bar">
          <input type="number" id="search-sid" class="search-input" placeholder="输入店铺ID快速查询...">
          <button class="search-btn" onclick="handleQuickSearch()">搜索</button>
        </div>

        <div id="main-list"></div>
      </div>

      <div id="modal-overlay" class="modal-overlay" onclick="closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <h2 id="det-title" style="margin-top:0"></h2>
          <div id="det-stats" class="stat-summary"></div>
          <div id="det-body"></div>
        </div>
      </div>

      <script>
        const processedData = JSON.parse('${safeJson(data)}');
        const historyMap = JSON.parse('${safeJson(history)}');
        const nowTs = ${currentTs};

        function handleQuickSearch() {
          const sid = document.getElementById('search-sid').value;
          if (sid) showShopDetail(sid);
        }

        function getVipStatusHtml(level, expiredTime, expiredDate) {
          if (!level || level <= 0) return "";
          if (expiredTime < nowTs) return '<span class="badge badge-expired">VIP' + level + ' · 过期(' + expiredDate + ')</span>';
          const daysLeft = Math.ceil((expiredTime - nowTs) / 86400);
          if (daysLeft <= 30) return '<span class="badge badge-warning">VIP' + level + ' · ' + daysLeft + '天内到期(' + expiredDate + ')</span>';
          return '<span class="badge badge-vip">VIP' + level + ' · 到期:' + expiredDate + '</span>';
        }

        function renderMain() {
          document.getElementById('main-list').innerHTML = processedData.map(day => {
            const totalShops = day.total.vShopCount + day.total.nShopCount;
            return \`
              <details>
                <summary>
                  <b style="width:85px">\${day.logDate}</b>
                  <span class="tag tag-admin">管理端: <b>\${day.total.tA.m}</b>人 / <b>\${day.total.tA.v}</b>次</span>
                  <span class="tag tag-client">客户端: <b>\${day.total.tC.m}</b>人 / <b>\${day.total.tC.v}</b>次</span>
                  <span class="tag" style="background:#fff; border-left:3px solid #722ed1; color:#722ed1">活跃店: <b>\${totalShops}</b> (VIP:<b>\${day.total.vShopCount}</b> / 普:<b>\${day.total.nShopCount}</b>)</span>
                </summary>
                <div style="padding:10px">
                  <table>
                    <thead><tr><th>店铺</th><th>管理(访/看)</th><th>客户(访/看)</th></tr></thead>
                    <tbody>
                      \${day.shops.map(s => \`
                        <tr class="shop-row" onclick="showShopDetail('\${s.id}')">
                          <td>
                            <b>\${s.name}</b> <small style="color:#999">ID:\${s.id}</small><br>
                            \${getVipStatusHtml(s.level, s.expiredTime, s.expiredDate)}
                          </td>
                          <td>\${s.admin?.member || 0} / \${s.admin?.viewDetial || 0}</td>
                          <td>\${s.custom?.member || 0} / \${s.custom?.viewDetial || 0}</td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                </div>
              </details>\`;
          }).join('');
        }

        function showShopDetail(sid) {
          const shop = historyMap[sid];
          if (!shop) return alert('未找到 ID 为 ' + sid + ' 的店铺数据');
          
          let tAM=0, tAV=0, tCM=0, tCV=0;
          shop.logs.forEach(l => {
            tAM += (l.admin.member||0); tAV += (l.admin.viewDetial||0);
            tCM += (l.custom.member||0); tCV += (l.custom.viewDetial||0);
          });

          document.getElementById('det-title').innerHTML = shop.name + getVipStatusHtml(shop.level, shop.expiredTime, shop.expiredDate);
          
          document.getElementById('det-stats').innerHTML = \`
            <div class="stat-card" style="border-left-color: #1989fa;">
              <div style="font-size:12px; color:#888">管理端累计</div>
              <div style="font-size:16px; font-weight:bold">\${tAM}人访 / \${tAV}次看</div>
            </div>
            <div class="stat-card" style="border-left-color: #52c41a;">
              <div style="font-size:12px; color:#888">客户端累计</div>
              <div style="font-size:16px; font-weight:bold">\${tCM}人访 / \${tCV}次看</div>
            </div>\`;

          let html = '<table><thead><tr><th>日期</th><th>管理端(访/看)</th><th>客户端(访/看)</th></tr></thead><tbody>';
          
          // 关键修正：对 logs 进行倒序排列，确保最新日期在最上方
          const sortedLogs = [...shop.logs].sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });

          sortedLogs.forEach(l => {
            html += \`<tr>
              <td>\${l.date}</td>
              <td>\${l.admin.member||0} / \${l.admin.viewDetial||0}</td>
              <td style="color:#52c41a; font-weight:bold;">\${l.custom.member||0} / \${l.custom.viewDetial||0}</td>
            </tr>\`;
          });
          document.getElementById('det-body').innerHTML = html + '</tbody></table>';
          document.getElementById('modal-overlay').style.display = 'flex';
        }

        function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
        renderMain();
      </script>
    </body></html>`;
  };

  const finalHtml = generateHtml(processedData, shopHistoryMap, days, nowTs);
  const filePath = path.join(process.cwd(), "tmp", `report_pro_v6_desc.html`);
  fs.writeFileSync(filePath, finalHtml);
  console.log(`\n✨ [成功] 报表已生成！弹窗日期已修正为倒序排列。\n路径：${filePath}\n`);
};

const init = async () => {
  setTimeout(() => {
    // this.clearImgs({ showDetails: false, id: {start: 2000, end: 2500}, isExec: false }) // 清理图片
    // this.countNouseFiles()  // 统计多少垃圾图片
    // this.vipExpiredHandle(-10) // 处理过期会员，会把产品mode 置 1
    // this.resetProductMode(5) // 把产品mode 置 0
    // this.handleLogsToHtml(100) // 统计日志
  }, 0);
}

init()
