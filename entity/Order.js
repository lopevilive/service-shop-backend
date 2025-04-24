
module.exports = {
  name: 'Order',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    orderId: {type: 'varchar', nullable: true, index: true}, // 订单号
    userId: {type: 'int'},
    shopId: {type: 'int'},
    level: {type: 'int', nullable: true},
    orderType: {type: 'int'}, // 0-开通、1-续费
    duration: {type: 'float'}, // 开通时长，单位年
    totalFee: {type: 'int'}, // 总金额，单位分
    status: {type: 'int'}, // 订单状态：0-待支付，1-已支付，2-已取消，3-退款中，4-已退款
    paymentStatus: {type: 'int'}, // 0-未支付，1-支付成功，2-支付失败，3-支付超时
    prepay_id: {type: 'varchar', nullable: true}, // 微信预支付订单号（调用统一下单接口返回）
    transaction_id: {type: 'varchar', nullable: true}, // 微信支付交易号（支付成功后回调返回）
    pay_time: {type: 'varchar', nullable: true}, // 支付时间
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}