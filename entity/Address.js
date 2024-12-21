
module.exports = {
  name: 'Address',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'int', index: true},
    province: {type: 'varchar', nullable: true}, // 省
    city: {type: 'varchar', nullable: true}, // 市
    county: {type: 'varchar', nullable: true}, // 区
    addressDetail: {type: 'varchar', nullable: true}, //详细地址
    areaCode: {type: 'varchar', nullable: true}, // 邮编
    name: {type: 'varchar', nullable: true}, // 姓名
    tel: {type: 'varchar', nullable: true}, //电话
    isDefault: {type: 'int', default: 0}, // 是否默认地址 0-否、1-是
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}