const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const crypto = require('crypto');
const _ = require('lodash');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const fs = require('fs');
const { default: axios } = require("axios");

const wxUrl = 'https://api.mch.weixin.qq.com'


module.exports.createOrderSign = async (method, url, timestamp, nonce_str, body) => {
  // 签名串
  let signStr = `${method}\n${url}\n${timestamp}\n${nonce_str}\n${body}\n`;
  // 读取API证书文件内容 apiclient_key.pem的内容
  let cert = fs.readFileSync(path.join(process.cwd(),"config/apiclient_key.pem"), "utf-8"); 
  // 创建使用 RSA 算法和 SHA-256 散列算法的签名对象
  let sign = crypto.createSign("RSA-SHA256");
  // 对签名串进行加密处理
  sign.update(signStr);
  return sign.sign(cert, "base64");
}

exports.createPaySign = async function (prepay_id) {
  const timeStamp = util.getNowTime();
  const nonceStr = util.generateNonceStr(32);
  const { appid } = util.getConfig('appInfo');
  let signStr = `${appid}\n${timeStamp}\n${nonceStr}\nprepay_id=${prepay_id}\n`;
  let cert = fs.readFileSync(path.join(process.cwd(),"config/apiclient_key.pem"), "utf-8"); 
  let sign = crypto.createSign("RSA-SHA256");
  sign.update(signStr);
  return {
      paySign: sign.sign(cert, "base64"),
      timeStamp,
      nonceStr,
      signType: 'RSA',
      package: 'prepay_id=' + prepay_id
  };
}

module.exports.createOrder = async ({userId, openid, shopInfo, level: targetLevel}) => {
  const nowTime = util.getNowTime()
  const orderId = util.createOrderId('EE', nowTime)
  const { id: shopId } = shopInfo
  const amount = util.getRestAmount(shopInfo.level, shopInfo.expiredTime) // 账户换算剩余的钱
  let totalFee = 0
  let orderType = 0
  let duration = 1
  const targetPrice = util.getVipPrice(targetLevel)
  if (targetLevel === shopInfo.level) { // 续费
    orderType = 1
    totalFee = targetPrice
  } else {
    if (amount > targetPrice) { // 剩余的钱足够升级
      totalFee = 0
      duration = parseFloat((amount / targetPrice).toFixed(2))
    } else {
      totalFee = targetPrice - amount
    }
  }
  // console.log(totalFee, 'totalFee')
  // totalFee= 1 // 用于测试 totest

  const params = {
    orderId, userId, level: targetLevel, shopId, orderType, duration, 
    totalFee, status: 0, paymentStatus: 0, add_time: nowTime
  }
  const orderRes = await dao.create('Order', params)
  if (totalFee === 0) { // 不需要支付，直接完成订单
    await finishedOrder(orderRes.id, shopInfo)
    return {
      done: true
    }
  }

  const mchid = util.getConfig('mchid')
  const serial_no = util.getConfig('serial_no')
  const { appid } = util.getConfig('appInfo');
  const wxOrderInfo = {
    mchid, appid, notify_url: 'https://huace.xiaoguoxx.cn/',
    out_trade_no: orderId,
    description: '小果图册开通会员',
    amount: {total: totalFee, currency: 'CNY'},
    payer: {openid}
  }
  let nonce_str = util.generateNonceStr(32);
  try {
    let signature = await this.createOrderSign('POST', '/v3/pay/transactions/jsapi', nowTime, nonce_str, JSON.stringify(wxOrderInfo))
    let Authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce_str}",timestamp="${nowTime}",signature="${signature}",serial_no="${serial_no}"`;
    const ret = await axios.post(`${wxUrl}/v3/pay/transactions/jsapi`, wxOrderInfo, {
      headers: {Authorization, Accept: 'application/json', 'Content-Type': 'application/json'}
    })

    const data = ret.data
    if (data.prepay_id) {
      await dao.update('Order', orderRes.id, {prepay_id: data.prepay_id, upd_time: util.getNowTime()})
      const payRet = await this.createPaySign(data.prepay_id)
      return {
        ...payRet,
        id: orderRes.id
      }
    } else {
      throw new Error('系统繁忙，请稍后重试～')
    }
  } catch(e) {
    console.error(e)
    throw e
  }
}

const finishedOrder = async (id, shopInfo) => {
  let orderInfo = await dao.list('Order', {columns: {id}})
  if (orderInfo.length !== 1) throw new Error('订单不存在')
  orderInfo = orderInfo[0]
  // 此时 pay_time 存上一个 expiredTime，方便对账
  await dao.update('Order', id, {status: 1, upd_time: util.getNowTime(), pay_time: shopInfo.expiredTime})
  await handleOrder(orderInfo, shopInfo)
}

const handleOrder = async (orderInfo, shopInfo) => {
  const {orderType, duration, level, shopId} = orderInfo
  let base = util.getNowTime()
  if (orderType === 1) { // 续费
    if (shopInfo.expiredTime > base) base = shopInfo.expiredTime
  }
  const expiredTime = base + duration * (12 * 30 + 7) * 24 * 60 * 60
  await dao.update('Shop', shopId, {level, expiredTime})
}

module.exports.queryOrder = async (id, shopInfo) => {
  let orderInfo = await dao.list('Order', {columns: {id}})
  if (orderInfo.length !== 1) throw new Error('订单不存在')
  orderInfo = orderInfo[0]
  const {orderId, status} = orderInfo
  if (status === 1) return status
  const nowTime = util.getNowTime()
  const nonce_str = util.generateNonceStr(32);
  const mchid = util.getConfig('mchid')
  const serial_no = util.getConfig('serial_no')
  const wxPath = `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${mchid}`
  const signature = await this.createOrderSign('GET', wxPath, nowTime, nonce_str, '')
  const Authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce_str}",timestamp="${nowTime}",signature="${signature}",serial_no="${serial_no}"`;
  const ret = await axios.get(`${wxUrl}${wxPath}`, {
    headers: {Authorization, Accept: 'application/json', 'Content-Type': 'application/json'}
  })
  const data = ret.data
  const {trade_state, transaction_id, success_time} = data
  if (trade_state === 'SUCCESS') {
    await dao.update('Order', id, {pay_time: success_time, transaction_id, paymentStatus: 1, status: 1, upd_time: util.getNowTime() })
    await handleOrder(orderInfo, shopInfo)
    return 1
  } else {
    return 0
  }

}

