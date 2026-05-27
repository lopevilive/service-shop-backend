/**
 * 用来存放一些不需要处理的日志
 */

module.exports = {
  name: 'CusLogs',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    /**
     *  1-图册/图片审核次数，理论上只有 1 条
     *  2-图册/微信图片审核次数，理论上只有 1 条
     *  3-图册/微信文字审核次数，理论上只有 1 条
     *  4-图册/上报数据，每天产生 1 条数据，upd_time 为当天 0 点时间戳
     *  5-图册/开通会员记录，主要记录开通前后的等级和过期时间
     */
    logType: {type: 'int', index: true},
    content: {type: 'text', nullable: true},
    userId: {type: 'int', nullable: true},
    shopId: {type: 'int', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}