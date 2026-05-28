/**
 * 虚拟支付
 */

const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const crypto = require('crypto');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const { default: axios } = require("axios");
const wxApi = require(path.join(process.cwd(),"modules/wxApi"))

const vPayEnv = 0; // 0：现网环境(正式环境)，1：沙箱环境
const testProductId = 'vip_lv_test'
const testPrice = 100


// 4. 内置 HmacSHA256 签名算法
const calcHmacSha256 = (key, message) => {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
};


/**
 * 轮询订单状态（基于 while 循环与安全时限）
 * @param {String} outTradeNo 商户订单号
 * @param {String} openid 用户的 openid
 */
const queryPoll = async (outTradeNo, openid) => {
  // 安全阀：限制最大轮询次数。10秒一次，40次等于400秒（超过5分钟）
  const MAX_POLL_COUNT = 40; 
  let count = 1;
  let isLooping = true;

  while (isLooping) {
    if (count > MAX_POLL_COUNT) break; // 跳出 while 循环
    try {
      // 2. 调用主动查询发货逻辑
      const status = await module.exports.queryWxVirtualOrder(outTradeNo, openid);
      // console.log(`[订单轮询监控] 订单号: ${outTradeNo} 第 ${count} 次执行，当前状态码: ${status}`);
      /**
       * 状态码拦截判断：
       * 0 - 待支付 -> 说明用户还没付完，需要继续等待
       * 1, 2, 4, 5 -> 均属于订单终态，需要立刻终止轮询
       */
      if (status !== 0) {
        isLooping = false; // 改变条件，或直接在这里 break;
        continue;
      }
      // 3. 如果状态还是 0 (待支付)，增加计数，并等待下一次循环
      count++;
      await util.sleep(10000);

    } catch (err) {
      // 4. 容错处理：如果内部逻辑抛错（例如数据库闪断、微信侧接口超时）
      // 策略：遇到异常不立刻崩溃退出，同样算作一次消耗，稍微拉长等待时间
      count++;
      await util.sleep(20000);
    }
  }
};

module.exports.createWxVirtualOrder = async (req) => {
  const {body: {shopId, level, code, payType = 0},userInfo: {id: userId} } = req
  const { appid, secret, virtualTest, VirtualProd, offerId } = util.getConfig('album.appInfo');
  const AppKey = vPayEnv === 0 ? VirtualProd : virtualTest;
  const { openid, session_key } = await wxApi.getWxOpenid(code, appid, secret);
  const nowTime = util.getNowTime()
  if (!openid) throw new Error('未能成功换取微信 session_key');
  // 1. 根据前端传过来的等级，匹配你在微信虚拟支付后台审核通过的【道具ID】和价格
  let productId = '';
  let price = 0; // 单位：分
  const levelCfg = util.getConfig('album.levelCfg')
  const matchedItem = levelCfg.find((item) => item.level === level)
  if (!matchedItem) throw new Error('参数有误，请联系客服')

  productId = matchedItem.productId
  price = matchedItem.price
  // productId = testProductId;
  // price = testPrice
  try {
    const outTradeNo = util.createOrderId('XG', nowTime);
    // 3. 组装 2026 虚拟支付规范的标准 signData 对象
    const signDataObj = {
      offerId,
      buyQuantity: 1,
      env: vPayEnv, // 0：现网环境(正式环境)，1：沙箱环境
      currencyType: 'CNY',
      productId,
      goodsPrice: price,
      outTradeNo,
    };
    // ⚠️ 参与签名的 postBody 必须和最终吐给前端的 signData 保持一字不差
    const postBody = JSON.stringify(signDataObj);
    const paySig = calcHmacSha256(AppKey, `requestVirtualPayment&${postBody}`);
    const signature = calcHmacSha256(session_key, postBody);
    await dao.create('AlbumVirtualOrder', {
      orderId: outTradeNo, userId, shopId, level, duration: 1, totalFee: price, status: 0, add_time: nowTime, payType
    })

    setTimeout(() => {
      queryPoll(outTradeNo, openid)
    }, 10000);

    return {
      signData: postBody,   // 前端直接传给 wx.requestVirtualPayment 的 signData
      paySig: paySig,       // 支付签名
      signature: signature,  // 用户态签名
      outTradeNo, // 订单号，方便前端查询
    };
  } catch (error) {
    // console.error('整合方法内创建虚拟支付订单失败:', error);
    await dao.create('XaCache', {dataType: 30, add_time: util.getNowTime(), content: JSON.stringify({
      msg: error.message || '未知错误',
      shopId, userId, level
    })})
    throw error
  }
};
/**
 * 调用微信通知已发货完成接口
 * @param {String} outTradeNo 小果商户订单号
 * @param {String} wxOrderId 微信内部单号（即 queryRet.wx_order_id）
 * @param {String} accessToken 小程序全局令牌
 * @param {String} AppKey 当前环境对应的支付密钥
 * @returns {Promise<Boolean>} 是否通知成功
 */
const notifyProvideGoods = async (payload) => {
  const {outTradeNo, wxOrderId, accessToken, AppKey} = payload
  const provideBodyObj = {
    order_id: outTradeNo,         // 下单时传的单号
    wx_order_id: wxOrderId || "", // 微信内部单号
    env: vPayEnv                  // 0-正式环境 1-沙箱环境
  };
  const postBody = JSON.stringify(provideBodyObj);
  const uri = '/xpay/notify_provide_goods';
  const paySig = calcHmacSha256(AppKey, `${uri}&${postBody}`);
  const targetUrl = `https://api.weixin.qq.com${uri}?access_token=${accessToken}&pay_sig=${paySig}`;
  try {
    const response = await axios.post(targetUrl, postBody, { headers: {'Content-Type': 'application/json' }});
    const resData = response.data;
    // 4. 解析微信返回结果（微信成功通常返回 { errcode: 0, errmsg: "ok" }）
    if (resData && resData.errcode === 0) {
      return true;
    } else {
      // 触发业务报警，记录到缓存中
      await dao.create('XaCache', { dataType: 33,  add_time: util.getNowTime(), content: JSON.stringify({
        msg: '微信通知发货接口返回业务异常',
        errcode: resData?.errcode,
        errmsg: resData?.errmsg,
        outTradeNo
      })});
      return false;
    }
  } catch (error) {
    // 捕获网络层超时、断网等异常
    await dao.create('XaCache', { dataType: 34,  add_time: util.getNowTime(), content: JSON.stringify({
      msg: '请求微信通知发货接口发生网络/系统错误',
      error: error.message || '未知错误',
      outTradeNo
    })});
    return false;
  }
};

/**
 * 主动查询微信虚拟支付现金订单状态（完全对齐 query_order 专有文档）
 * @param {String} outTradeNo 你的商户订单号
 * @param {String} openid 用户的openid
 * 返回：0-待支付，1-已支付，2-已取消，3-退款中，4-已退款，5-订单异常
 */
module.exports.queryWxVirtualOrder = async (outTradeNo, openid) => {
  const { appid, secret, virtualTest, VirtualProd } = util.getConfig('album.appInfo');
  const AppKey = vPayEnv === 0 ? VirtualProd : virtualTest;
  if (!outTradeNo || !openid) throw new Error('参数有误')
  try {
    const manager = await dao.getManager()
    const ret = await manager.transaction(async (transactionalEntityManager) => {
      const instance = await transactionalEntityManager.createQueryBuilder('AlbumVirtualOrder', 'AlbumVirtualOrder');
      instance.setLock('pessimistic_write');
      instance.where('AlbumVirtualOrder.orderId = :outTradeNo', {outTradeNo});
      const orderInfo = await instance.getOne()
      if (!orderInfo) throw new Error('订单号有误，请联系管理员~')
      if (orderInfo.status === 1) { // 说明已经支付并且处理完了，不需要重复处理
        return 1
      }
      if (orderInfo.status === 2) { // 订单已经取消
        return 2
      }
      if (orderInfo.status === 4) { // 订单已退款
        return 4
      } 
      if (orderInfo.status === 5) { // 订单异常
        return 5
      }
      const shopId = orderInfo.shopId
      if (orderInfo.status === 0) { // 订单待支付状态
        const accessToken = await wxApi.getAccessToken({appid, secret}); 
        const requestBodyObj = { // 组装 Request Payload
          openid: openid,
          env: vPayEnv,                 // ⚠️ 0-正式环境 1-沙箱环境，必须和下单保持一致
          order_id: outTradeNo,   // 🛑 注意：文档里叫 order_id
          wx_order_id: ""         // 二选一，传了 order_id 这里可以留空
        };
        const postBody = JSON.stringify(requestBodyObj); // 序列化为标准的 JSON 字符串
        const uri = '/xpay/query_order'; // 计算专有服务器 pay_sig
        const paySig = calcHmacSha256(AppKey, `${uri}&${postBody}`); // 算法公式：uri + '&' + postBody
        const targetUrl = `https://api.weixin.qq.com${uri}?access_token=${accessToken}&pay_sig=${paySig}`;
        const response = await axios.post(targetUrl, postBody, { headers: { 'Content-Type': 'application/json' } });
        const resData = response.data;
        if (resData.errcode !== 0) { // 查询出错了
          await dao.create('XaCache', {dataType: 31, add_time: util.getNowTime(), content: JSON.stringify({
            errcode: resData.errcode, errmsg: resData.errmsg, outTradeNo, openid,
          })})
          if (resData.errcode === 268490002) return 2
          return 0
        }
        const queryRet = resData.order;
        // console.log(queryRet, 'queryRet')
        if ([2,3].includes(queryRet.status)) { // 订单已经支付，待发货。核心
          try {
            let shopInfo = await dao.list('Shop', {columns: {id: shopId}})
            shopInfo = shopInfo[0]
            if (!shopInfo) throw new Error(`店铺信息不存在：${shopId}`)
            const currLevel = shopInfo.level
            const targetLevel = orderInfo.level
            let base = util.getNowTime()
            let endTime = 0 // 会员到期时间戳
            if (currLevel === targetLevel) { // 续费
              if (shopInfo.expiredTime > base) base = shopInfo.expiredTime
            }
            if (targetLevel > currLevel && shopInfo.expiredTime > base) { // 升级
              const levelCfg = util.getConfig('album.levelCfg')
              const targetCfg = levelCfg.find((item) => item.level === targetLevel)
              const restAmount = util.getRestAmount(currLevel, shopInfo.expiredTime) // 剩余金额
              const preDayPrice = Math.floor(targetCfg.price / 365) // 每天的费用
              const restDays = Math.ceil(restAmount / preDayPrice) // 补偿天数
              base = base + restDays * 24 * 60 * 60
            }
            endTime = base + orderInfo.duration * (12 * 30 + 7) * 24 * 60 * 60
            await transactionalEntityManager.update('Shop', {id: shopInfo.id}, {
              level: targetLevel, expiredTime: endTime, upd_time: util.getNowTime(), mode: 0
            })
            const notifyRet = await notifyProvideGoods({outTradeNo, wxOrderId: queryRet.wx_order_id, AppKey, accessToken })
            if (notifyRet) { // 通知微信发货成功
              await transactionalEntityManager.update('AlbumVirtualOrder', {id: orderInfo.id}, { // 更新订单状态
                status: 1, upd_time: util.getNowTime(), order_type: queryRet.order_type, wx_order_id: queryRet.wx_order_id,
                wxpay_order_id: queryRet.wxpay_order_id, wxPayStatus: queryRet.status, pay_time: queryRet.paid_time
              })
              dao.create('CusLogs', {logType: 5, add_time: util.getNowTime(), shopId, content: JSON.stringify({ // 记录会员变化
                preLevel: currLevel,
                preExpiredTime: shopInfo.expiredTime,
                targetLevel: targetLevel,
                targetExpiredTime: endTime,
                outTradeNo
              })})
              
              const products = await dao.list('Product', {columns: {shopId, mode: 1}, only: ['id']})
              if (products.length !== 0) {
                const idsToUpdate = products.map(p => p.id)
                await dao.update('Product', idsToUpdate, {mode: 0})
              }

              return 1
            } else { // 通知微信发货失败，订单进入异常状态
              await transactionalEntityManager.update('AlbumVirtualOrder', {id: orderInfo.id}, {
                status: 5, upd_time: util.getNowTime()
              })
              return 5
            }
          } catch(e) { //用户已经支付成功，但是代码执行发货整体逻辑出错，订单进入异常状态
            await transactionalEntityManager.update('AlbumVirtualOrder', {id: orderInfo.id}, {
              status: 5, upd_time: util.getNowTime()
            })
            await dao.create('XaCache', { dataType: 35,  add_time: util.getNowTime(), content: JSON.stringify({
              msg: '发货代码执行出错',
              error: e.message || '未知错误',
              outTradeNo
            })});
            return 5
          }
        }
        // 订单已支付并且已经发货。理论上不会出现
        if (queryRet.status === 4) return 1
        if (queryRet.status === 6) { // 订单已经关闭（不可再使用）
          await transactionalEntityManager.update('AlbumVirtualOrder', {id: orderInfo.id}, {
            status: 2, upd_time: util.getNowTime(), order_type: queryRet.order_type, wx_order_id: queryRet.wx_order_id,
            wxpay_order_id: queryRet.wxpay_order_id, wxPayStatus: queryRet.status
          })
          return 2
        }
      }
      return 0 // 兜底
    })
    return ret
  } catch (error) {
    await dao.create('XaCache', {dataType: 32, add_time: util.getNowTime(), content: JSON.stringify({
      msg: error.message || '未知错误', outTradeNo
    })})
    throw error
  }
};

// this.queryWxVirtualOrder('XG2026052416176106465515', 'oJtiB7bd45oujxYGI9rXg2cjIn0w')

