
module.exports = {
  name: 'WatermarkCfg',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    shopId: {type: 'int'}, // 索引
    type: {type: 'int'}, // 1-图片水印、2-文字水印
    text: {type: 'varchar', nullable: true}, // 文字水印内容
    cfg: {type: 'varchar', nullable: true, length: 1000}, // 水印配置
    configkey: {type: 'varchar', nullable: true},
    previewUrl: {type: 'varchar', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}