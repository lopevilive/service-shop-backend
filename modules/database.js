// ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';

require('mysql2');
var path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const { ConnectionManager, EntitySchema } = require("typeorm");


class DbManage {
  constructor() {
    this.connectionManager = new ConnectionManager();
    this.db_config = util.getConfig("default.db_config");
    this.entities = [
      new EntitySchema(require(path.join(process.cwd(),"entity",'Shop'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Product'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'ProductTypes'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'User'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Staff'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Address'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Enventory'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Feedback'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'WatermarkCfg'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'CusLogs'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'Order'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'ZaList'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'ZaUser'))),
      new EntitySchema(require(path.join(process.cwd(),"entity",'XaCache'))),
    ]
    this.connection = this.connectionManager.create({...this.db_config, entities: this.entities})
    this.timer = null
    this.timeOut = 60 // 超时断开连接 单位秒
  }

  async refreshTimeOut() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (this.connection.isInitialized) this.connection.destroy()
    }, this.timeOut * 1000)
  }

  async connectDb() {
    const {connection} = this
    let retryNum = 20; // 重试次数
    const timeO = 500; // 重试间隔，毫秒

    while (retryNum > 0) {
      try {
        if (connection.isInitialized) {
          return;
        }
        await connection.initialize() // 连接逻辑不变
        return; // 连接成功，直接退出
      } catch(e) {
        retryNum -= 1;
        // 重试次数用完，抛出错误
        if (retryNum <= 0) {
          throw e
        }
        // 等待后继续重试
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve()
          }, timeO);
        })
      }
    }
  }

  async getModel(entityName) {
    const {connection} = this
    if (!connection.isInitialized) {
      await this.connectDb()
    }
    this.refreshTimeOut()
    const model = connection.getRepository(entityName)
    if(!model) return new Error('模型不存在')
    return model
  }
}

module.exports.db = new DbManage()