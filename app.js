// sudo chown -R username directory_name
const express = require('express');
const path = require('path')
const bodyParser = require('body-parser')
const resextra = require('./modules/resextra')
const database = require('./modules/database')
const albumRoutes = require('./routes/api/album.js')
const userRoutes = require('./routes/api/user.js')
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN, CODE_LOGIN_ERR, CODE_PERMISSION_ERR}} = require(path.join(process.cwd(),"util/errCode"))


// 获取验证模块
const authorization = require(path.join(process.cwd(), '/modules/authorization'))

// 设置全局权限
authorization.setAuthFn(async function(req, res, next, serviceName, actionName, passFn) {
  const rule = authorization.rules[serviceName] && authorization.rules[serviceName][actionName]
  if (rule) {
    try {
      const retCode = await authorization.execRule(rule, req, res, serviceName, actionName)
      if (retCode === CODE_SUCC) {
        return passFn(true)
      }
      if (retCode === CODE_PERMISSION_ERR) {
        return passFn(false)
      }
      res.sendResult(null, retCode)
    } catch(err) {
      res.sendResult(null, CODE_UNKNOWN, err.message)
    }
  } else {
    passFn(true)
  }
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
// app.use('/tmp_uploads',express.static('tmp_uploads')) 
app.use('/dist/assets', express.static('dist/assets', {
  lastModified: false,
  maxAge: '30 days'
}))
app.use('/dist',express.static('dist'))


/**
 *
 * 公共系统初始化
 *
 */
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))


// 设置跨域和相应数据格式
app.all('/api/*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin)
  res.setHeader("Access-Control-Allow-Credentials", true);  
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

app.use('/api/album', albumRoutes)
app.use('/api/user', userRoutes)

/**
 *
 * 统一处理无响应
 *
 */
// 如果没有路径处理就返回 Not Found
app.use(function(req, res, next) {
  console.log('not found~~~~')
  if (/dist/.test(req.path)) {
    res.sendfile('./dist/index.html')
  } else if (/hWz9nuJO91/.test(req.path)) {
    res.sendfile('./hWz9nuJO91.txt')
  }
   else {
    res.sendResult(null, 404, 'Not Found')
  }
})
app.listen(9000)