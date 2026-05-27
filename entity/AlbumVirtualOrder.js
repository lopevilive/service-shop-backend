
module.exports = {
  name: 'AlbumVirtualOrder',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    orderId: {type: 'varchar', nullable: true, index: true}, // 订单号
    userId: {type: 'int'},
    shopId: {type: 'int'},
    level: {type: 'int', nullable: true},
    duration: {type: 'float'}, // 开通时长，单位年
    payType: {type: 'int'}, // 0-开通、1-续费、2-升级
    totalFee: {type: 'int'}, // 总金额，单位分
    status: {type: 'int'}, // 小果内部订单状态：0-待支付，1-已支付，2-已取消，3-退款中，4-已退款、5-订单异常
    wxPayStatus: {type: 'int', nullable: true}, // 虚拟支付订单状态。参考：https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order.html#Res-order-status-Enum
    pay_time: {type: 'varchar', nullable: true}, // 支付时间
    refund_time: {type: 'varchar', nullable: true}, // 退款时间
    wx_order_id: {type: 'varchar', nullable: true}, // 微信内部单号
    wxpay_order_id: {type: 'varchar', nullable: true}, // 微信支付交易单号，为用户微信支付详情页面上的交易单号
    order_type: {type: 'int', nullable: true}, // 0-普通虚拟支付、1-普通退款、7-苹果iOS支付、8-苹果iOS退款
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}