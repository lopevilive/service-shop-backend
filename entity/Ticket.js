// 管理票据
module.exports = {
  name: 'Ticket',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    expiredTime: {type: 'int'}, // 过期时间
    random: {type: 'int'}, // 随机数
    content: {type: 'varchar', unique: true, index: true}, // 内容
  }
}