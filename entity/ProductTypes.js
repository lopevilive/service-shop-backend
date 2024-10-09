
module.exports = {
  name: 'ProductTypes',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    shopId: {type: 'int'},
    name: {type: 'varchar'},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}