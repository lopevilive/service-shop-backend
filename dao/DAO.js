var path = require("path");
const { In } = require("typeorm");

// 获取数据库模型
const { db } = require(path.join(process.cwd(),"modules/database"));

/**
 * 创建对象数据
 * 
 * @param  {[type]}   modelName 模型名称
 * @param  {[type]}   obj       模型对象
 * @param  {Function} cb        回调函数
 */
module.exports.create = async function(entityName,obj) {
  const model = await db.getModel(entityName)
  const res = await model.createQueryBuilder().insert().into(entityName).values(obj).execute();
  const {identifiers} = res
  return identifiers[0]
}

/**
 * 获取所有数据
 * 
 * @param  {[type]}   conditions 查询条件
 * 查询条件统一规范
 * conditions
	{
		"columns" : {
			字段条件
			"字段名" : "条件值"
		},
		"offset" : "偏移",
		"omit" : ["字段"],
		"only" : ["需要字段"],
		"limit" : "",
		"order" :[ 
			"字段" , A | Z,
			...
		]
	}
 * @param  {Function} cb         回调函数
 */
module.exports.list = async function(entityName,conditions) {
  const model = await db.getModel(entityName)
  const execCondi = {}

  if (!conditions) conditions = {}
  if (conditions['columns']) {
    execCondi.where = conditions['columns']
  }
  if (conditions['only']) {
    execCondi.select = conditions['only']
  }
  if (conditions['skip']) {
    execCondi.skip = conditions['skip']
  }
  if (conditions['take']) {
    execCondi.take = conditions['take']
  }
  if (conditions['order']) {
    execCondi.order = conditions['order']
  }

  const res = await model.find(execCondi)
  return res
};


/**
 * 更新对象数据
 * 
 * @param  {[type]}   modelName 模型名称
 * @param  {[type]}   id        数据关键ID
 * @param  {[type]}   updateObj 更新对象数据
 * @param  {Function} cb        回调函数
 */
module.exports.update = async function(entityName,id,updateObj) {
  const model = await db.getModel(entityName)
  if (!Array.isArray(id)) {
    id = [id]
  }
  await model.createQueryBuilder().update(entityName).set(updateObj).where('id in (:...id)', {id}).execute();
}


module.exports.delete = async function(entityName, id) {
  const model = await db.getModel(entityName)
  let ids = id
  if (!Array.isArray(ids)) {
    ids = [ids]
  }
  await model.delete({id: In(ids)})
}

// 用于主动连接db
module.exports.connect = async () => {
  await db.getModel('Shop')
}

module.exports.createQueryBuilder = async (entityName) => {
  const model = await db.getModel(entityName)
  return model.createQueryBuilder()
}

module.exports.getManager = async ()  => {
  await this.connect()
  return db.connection.manager
}

