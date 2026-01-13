
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
     * 4-图册/文本校验失败记录
     * 5-图册/文本校验需要 review 的内容
     * 6-图册/文本校验 risky 的内容
     * 
     * 7-图册/图片 cos 审核需要复审的内容
     * 8-图册/图片 cos 审核违规的内容
     * 
     * 9-图册/微信图片校验失败记录
     * 10-图册/微信图片审核状态1-发起了审核微信返回 trace_id
     * 11-图册/微信图片审核状态2-微信结果异步返回
     * 12-图册/微信图片审核状态3-处理完成，正常这个时候已经删除了
     * 13-图册/微信图片结果需要 review
     * 14-图册/微信图片结果 risky
     */
    dataType: {type: 'int', index: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}