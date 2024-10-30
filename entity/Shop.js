
module.exports = {
  name: 'Shop',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'varchar'},
    name: {type: 'varchar'},
    desc: {type: 'varchar'},
    url: {type: 'text'},
    area: {type: 'varchar'},
    address: {type: 'varchar'},
    phone: {type: 'varchar'},
    qrcodeUrl: {type: 'varchar'},
    business: {type: 'int', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}