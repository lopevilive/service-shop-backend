
module.exports = {
  name: 'CusLogs',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    logType: {type: 'int', index: true}, //1-图片审核次数，理论上只有1条、2-图片审核敏感日志  3-图片审核违规日志
    content: {type: 'text', nullable: true},
    userId: {type: 'int', nullable: true},
    shopId: {type: 'int', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}