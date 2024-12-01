// ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';

require('mysql2');
var path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const { ConnectionManager, EntitySchema } = require("typeorm");


class DbManage {
  constructor() {
    this.connectionManager = new ConnectionManager();
    this.db_config = util.getConfig("db_config");
    this.entities = [
      new EntitySchema(require(path.join(process.cwd(),"entity",'Shop'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Product'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'ProductTypes'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'User'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Staff'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Ticket'))),
    ]
    this.connection = this.connectionManager.create({...this.db_config, entities: this.entities})
    this.timer = null
    this.timeOut = 60 // 超时断开连接 单位秒
  }

  async refreshTimeOut() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (this.connection.isConnected) this.connection.close()
    }, this.timeOut * 1000)
  }

  async getModel(entityName) {
    const {connection} = this
    if (!connection.isConnected) await connection.connect()
    this.refreshTimeOut()
    const model = connection.getRepository(entityName)
    if(!model) return new Error('模型不存在')
    return model
  }
}

module.exports.db = new DbManage()