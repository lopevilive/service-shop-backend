
module.exports = {
  name: 'Enventory',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'int' },
    shopId: {type: 'int' },
    add_time: {type: 'int', nullable: true},
    data: {type: 'text', nullable: true },
  }
}