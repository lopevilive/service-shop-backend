
module.exports = {
  name: 'User',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    openid: {type: 'varchar', unique: true},
    unionid: {type: 'varchar', unique: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}