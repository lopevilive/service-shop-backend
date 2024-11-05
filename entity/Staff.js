module.exports = {
  name: 'Staff',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'int'},
    shopId: {type: 'int'},
    nickName: {type: 'varchar'}, // 昵称
    type: {type: 'int'}, // 1-管理员、2-分销员
    phone: {type: 'varchar', nullable: true}, // 联系电话
    qrcodeUrl: {type: 'varchar', nullable: true}, // 微信二维码
    status: {type: 'int', nullable: true}, // 1-待接受、2-已拒绝、3-已过期、4-已完成
    ticket: {type: 'varchar', nullable: true}, // 用于校验
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}