
module.exports = {
  name: 'Product',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    shopId: {type: 'int'},
    name: {type: 'varchar'},
    url: {type: 'text'},
    price: {type: 'varchar'},
    productType: {type: 'varchar'},
    desc: {type: 'varchar'},
    type3D: {type: 'int', nullable: true}, // 0-无、1-默认、2-url
    model3D: {type: 'int', nullable: true}, // 1-衣柜、2-地板、3-瓷砖
    modelUrl: {type: 'varchar'},
    status: {type: 'int', default: 0}, // 0-正常、1-下架
    sort: {type: 'int', default: 0}, // 排序，越大越在前面
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}