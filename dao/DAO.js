var path = require("path");

// 获取数据库模型
databaseModule = require(path.join(process.cwd(),"modules/database"));

const getModel = (entityName) => {
  var db = databaseModule.getDatabase();
  var model = db.getRepository(entityName);
  if(!model) return new Error('模型不存在')
  return model
}


/**
 * 创建对象数据
 * 
 * @param  {[type]}   modelName 模型名称
 * @param  {[type]}   obj       模型对象
 * @param  {Function} cb        回调函数
 */
module.exports.create = async function(entityName,obj) {
  var model = getModel(entityName)
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
	var model = getModel(entityName)

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
  var model = getModel(entityName)
  if (!Array.isArray(id)) {
    id = [id]
  }
  await model.createQueryBuilder().update(entityName).set(updateObj).where('id in (:...id)', {id}).execute();
}


/**
 * 通过模型名称获取数据库数量
 * 
 * @param  {[type]}   modelName 模型名称
 * @param  {Function} cb        回调函数
 */
module.exports.count = async function(entityName,columns = {}, groupBy) {
  var model = getModel(entityName)
  let sql = 'select'
  if (groupBy) sql += ` ${groupBy},`
  sql += ` count(*) as total from ${entityName}`

  let where = ''
  if (Object.keys(columns).length) {
    for (const key of Object.keys(columns)) {
      const val = columns[key]
      if (where) where += ' and '
      where += `${key} = ${val}`
    }
  }
  if (where) sql += ` where ${where}`
  if (groupBy) sql += ` group by ${groupBy}`
  // console.log(sql, 'sql')
  // select productType count(*) as total from Product where shopId = 5 group by productType
  sql = `select productType, count(*) as total from  album.product where shopId = 5 group by productType`
  const data = await model.query(sql)
  return data
}

module.exports.delete = async function(entityName, id) {
  var model = getModel(entityName)
  await model.delete(id)
}

module.exports.findOne = async (entityName, columns) => {
  var model = getModel(entityName)
  const res = await model.findOne(columns)
  return res
}
