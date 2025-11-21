
module.exports = {
  name: 'CusLogs',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    /**
     *  1-图片审核次数，理论上只有 1 条
     *  2-图片审核敏感日志 
     *  3-图片审核违规日志
     *  4-上报数据，每天产生 1 条数据，upd_time 为当天 0 点时间戳
     */
    logType: {type: 'int', index: true},
    content: {type: 'text', nullable: true},
    userId: {type: 'int', nullable: true},
    shopId: {type: 'int', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}