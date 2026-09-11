
/**
 * 帮我转mysql 语句，表名改为下划线，字段名不要改动，不要写注释
 * 用来存图片信息，方便前端做瀑布流
 */

module.exports = {
  name: 'AlbumImgInfo',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    imgKey: {type: 'varchar', nullable: true, index: true}, // 图片名称
    imgInfo: {type: 'varchar', nullable: true}, // 图片信息 {w:高度,h:宽度,data: 时间戳}
    shopId: {type: 'int'},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}