
module.exports = {
  name: 'CusLogs',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    logType: {type: 'int', index: true}, // 日志类型 1-图片审核日志 2-图片审核次数，理论上只有1条
    content: {type: 'text', nullable: true},
    userId: {type: 'int', nullable: true},
    shopId: {type: 'int', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}