// sudo chown -R username directory_name
const express = require('express');
const path = require('path')
const bodyParser = require('body-parser')
const resextra = require('./modules/resextra')
const database = require('./modules/database')
const  serviceCgiRoutes = require('./routes/api/serviceCgi.js')


// 获取验证模块
const authorization = require(path.join(process.cwd(), '/modules/authorization'))

// 设置全局权限
authorization.setAuthFn(function(req, res, next, serviceName, actionName, passFn) {
  // if (!req.userInfo || isNaN(parseInt(req.userInfo.rid))) return res.sendResult('无角色ID分配')
  // 验证权限
  // roleService.authRight(req.userInfo.rid, serviceName, actionName, function(err, pass) {
  //   passFn(pass)
  // })
  // todo 权限系统待完善
  passFn(true)
})

const app = express();

// 初始化数据库模块
database.initialize(app, function(err) {
  if (err) {
    console.error('连接数据库失败失败 %s', err)
  }
})



// 初始化统一响应机制
app.use(resextra)

// 静态资源
app.use('/tmp_uploads',express.static('tmp_uploads')) 

/**
 *
 * 公共系统初始化
 *
 */
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))



// 设置跨域和相应数据格式
app.all('/api/*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, mytoken')
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Authorization')
  res.setHeader('Content-Type', 'application/json;charset=utf-8')
  res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization, Accept,X-Requested-With')
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS')
  res.header('X-Powered-By', ' 3.2.1')
  if (req.method == 'OPTIONS') res.send(200)
  /*让options请求快速返回*/ else next()
})

// 路由加载
var mount = require('mount-routes')
mount(app, path.join(process.cwd(), '/routes'), true)
// mount(app, __dirname + '/routes1', true)

// app.use('/api', serviceCgiRoutes)

/**
 *
 * 统一处理无响应
 *
 */
// 如果没有路径处理就返回 Not Found
app.use(function(req, res, next) {
  console.log('not found~~~~')
  res.sendResult(null, 404, 'Not Found')
})
app.listen(8082)