
module.exports = {
  name: 'Shop',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'int'}, // 创建者
    name: {type: 'varchar'},
    desc: {type: 'varchar'},
    url: {type: 'text'},
    area: {type: 'varchar'},
    address: {type: 'varchar'},
    phone: {type: 'varchar'},
    qrcodeUrl: {type: 'varchar'},
    attrs: {type: 'text', nullable: true}, // 配置的属性
    level: {type: 'int',default: 0}, // 等级
    expiredTime: {type: 'int',default: 0}, // 过期时间
    business: {type: 'int', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}