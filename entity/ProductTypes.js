
module.exports = {
  name: 'ProductTypes',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    shopId: {type: 'int'},
    name: {type: 'varchar'},
    sort: {type: 'int', default: 0}, // 排序，越大的在前面
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}