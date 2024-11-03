// ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';

var fs = require("fs");
require('mysql2');
var typeorm = require("typeorm");
var EntitySchema = typeorm.EntitySchema;
var path = require("path");
const util = require(path.join(process.cwd(),"util/index"))

/*
	app: 应用程序环境
	config: 数据库配置
	callback: 回调
*/
async function initialize(app,callback) {
  const db_config = util.getConfig("db_config");
  const connection = await typeorm.createConnection({
    ...db_config,
    entities: [
        new EntitySchema(require(path.join(process.cwd(),"entity",'Shop'))),
        new EntitySchema(require(path.join(process.cwd(),"entity",'Product'))),
        new EntitySchema(require(path.join(process.cwd(),"entity",'ProductTypes'))),
        new EntitySchema(require(path.join(process.cwd(),"entity",'User'))),
        new EntitySchema(require(path.join(process.cwd(),"entity",'Staff'))),
    ]
  })
  global.database = connection
}

module.exports.initialize = initialize;
module.exports.getDatabase = function() {
	return  global.database;
}