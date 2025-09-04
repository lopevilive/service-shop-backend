
module.exports = {
  name: 'Product',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    shopId: {type: 'int'},
    name: {type: 'varchar'}, // 弃用
    url: {type: 'text'},
    price: {type: 'varchar'},
    isSpec: {type: 'int', default: 0},// 是否多规格 0-否、1-是
    specs: {type: 'varchar', nullable: true }, // 多规格配置 //弃用
    specDetials: { type: 'text', nullable: true },  // 多规格详情
    productType: {type: 'varchar'},
    isMulType: {type: 'int', default: 0}, // 是否多分类 0-否、1-是
    desc: {type: 'varchar', length: 800},
    type3D: {type: 'int', nullable: true}, // 0-无、1-默认、2-url
    model3D: {type: 'int', nullable: true}, // 1-衣柜、2-地板、3-瓷砖
    modelUrl: {type: 'varchar'},
    fields: {type: 'varchar', nullable: true}, // 行业个性字段
    status: {type: 'int', default: 0}, // 0-正常、1-下架
    sort: {type: 'int', default: 0}, // 置顶排序，越大越在前面
    pos: {type: 'int', default: 0}, // 产品顺序，越大越在前面
    attr: {type: 'text', nullable: true}, // 产品的一些属性 json 字符串格式
    descUrl: {type: 'text', nullable: true}, // 详情图
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}