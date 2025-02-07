
module.exports = {
  name: 'Feedback',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'int' },
    shopId: {type: 'int' },
    content: {type: 'varchar'},
    url: {type: 'varchar', length: 1000, nullable: true},
    contact: {type: 'varchar', nullable: true},
    add_time: {type: 'int', nullable: true},
  }
}