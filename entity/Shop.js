
module.exports = {
  name: 'Shop',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'varchar'},
    name: {type: 'varchar'},
    desc: {type: 'varchar'},
    logo: {type: 'varchar'},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}