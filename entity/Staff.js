module.exports = {
  name: 'Staff',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'int'},
    shopId: {type: 'int'},
    nickName: {type: 'varchar'}, // 昵称
    type: {type: 'int'}, // 1-管理员、2-分销员
    phone: {type: 'varchar'}, // 联系电话
    qrcodeUrl: {type: 'varchar'}, // 微信二维码
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}