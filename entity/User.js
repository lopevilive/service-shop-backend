
module.exports = {
  name: 'User',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    openid: {type: 'varchar', unique: true, index: true},
    unionid: {type: 'varchar', unique: true, nullable: true},
    phone: {type:'varchar', nullable: true}, // 手机号
    countryCode: {type:'varchar', nullable: true}, // 手机区号
    status: {type: 'int', default: 0}, // 用户状态，0-正常、1-黑名单
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}