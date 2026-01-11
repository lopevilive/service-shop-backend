
/**
 * 帮我转mysql 语句，表名改为下划线，字段名不要改动，不要写注释
 * 缓存和用来存放一些需要处理的日志
 */

module.exports = {
  name: 'XaCache',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    content: {type: 'text', nullable: true},
    key1: {type: 'varchar', nullable: true}, // 预留标识
    key2: {type: 'varchar', nullable: true},// 预留标识
    /**
     * 1-access_token
     * 4-文本校验失败记录
     * 5-图册文本校验需要 review 的内容
     * 6-图册文本校验 risky 的内容
     */
    dataType: {type: 'int', index: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}