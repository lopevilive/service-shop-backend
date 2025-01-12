
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
    attrs: {type: 'text', nullable: true}, // 配置的属性历史
    specCfg: {type: 'varchar', nullable: true}, // 配置的规格历史
    level: {type: 'int',default: 0}, // 等级
    expiredTime: {type: 'int',default: 0}, // 过期时间
    status: {type: 'int',default: 0}, // 0-正常、1-封禁状态
    business: {type: 'int', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}