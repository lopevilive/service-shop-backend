
module.exports = {
  name: 'Product',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    shopId: {type: 'int'},
    name: {type: 'varchar'},
    url: {type: 'varchar'},
    imgs: {type: 'text'},
    price: {type: 'varchar'},
    productType: {type: 'varchar'},
    desc: {type: 'varchar'},
    type3D: {type: 'int', nullable: true},
    model3D: {type: 'int', nullable: true},
    modelUrl: {type: 'varchar'},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}