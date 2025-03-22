
module.exports = {
  name: 'Enventory',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'int' },
    shopId: {type: 'int' },
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
    data: {type: 'text', nullable: true },
    type: {type: 'int', default: 0}, // 类型  0-清单、1-批量转发
    status: {type: 'int', default: 0}, // 清单状态 0-未处理、1-已完成、2-已取消
    orderId: {type: 'varchar', nullable: true}, // 清单号
  }
}