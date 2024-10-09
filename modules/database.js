// ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';

var fs = require("fs");
require('mysql2');
var typeorm = require("typeorm");
var EntitySchema = typeorm.EntitySchema;
var path = require("path");

/*
	app: 应用程序环境
	config: 数据库配置
	callback: 回调
*/
async function initialize(app,callback) {
  const connection = await typeorm.createConnection({
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "root",
    password: "123456",
    database: "album",
    synchronize: true,
    entities: [
        new EntitySchema(require(path.join(process.cwd(),"entity",'Shop'))),
        new EntitySchema(require(path.join(process.cwd(),"entity",'Product'))),
        new EntitySchema(require(path.join(process.cwd(),"entity",'ProductTypes'))),
    ]
  })
  // console.log(connection, 'asdsa')
  global.database = connection
}

module.exports.initialize = initialize;
module.exports.getDatabase = function() {
	return  global.database;
}