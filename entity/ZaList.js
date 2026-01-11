
/**
 * 帮我转mysql 语句，表名改为下划线，字段名不要改动，不要写注释
 */

module.exports = {
  name: 'ZaList',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    content: {type: 'text', nullable: true},
    dateTs: {type: 'int', index: true}, // 0点 时间戳
    dataType: {type: 'int', index: true}, // 1-油价信息、2-调价日
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}