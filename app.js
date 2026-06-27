// sudo chown -R username directory_name
const express = require('express');
const path = require('path')
const bodyParser = require('body-parser')
const resextra = require('./modules/resextra')
const albumRoutes = require('./routes/api/album.js')
const userRoutes = require('./routes/api/user.js')
const oilRoutes = require('./routes/api/oil.js')
const compression = require('compression');
const {ERR_CODE_MAP: {CODE_SUCC, CODE_PARAMS_ERR, CODE_UNKNOWN, CODE_LOGIN_ERR, CODE_PERMISSION_ERR}} = require(path.join(process.cwd(),"util/errCode"))

// require(path.join(process.cwd(), 'toolsScript/index.js')) // 执行一些脚本


// 获取验证模块
const authorization = require(path.join(process.cwd(), '/modules/authorization'))

// 设置全局权限
authorization.setAuthFn(async function(req, res, next, serviceName, actionName, passFn) {
  const rule = authorization.authMap[serviceName] && authorization.authMap[serviceName].getRule && authorization.authMap[serviceName].getRule(serviceName, actionName)
  const executor = authorization.authMap[serviceName] && authorization.authMap[serviceName].getRuleExecutor && authorization.authMap[serviceName].getRuleExecutor(serviceName, actionName)
  if (rule && executor) {
    try {
      const retCode = await executor(rule, req, res, serviceName, actionName)
      if (retCode === CODE_SUCC) {
        return passFn(true)
      }
      if (retCode === CODE_PERMISSION_ERR) {
        return passFn(false)
      }
      res.sendResult(null, retCode)
    } catch(err) {
      res.sendResult(null, CODE_UNKNOWN, err.message || err.msg || err)
    }
  } else {
    passFn(true)
  }
})

const app = express();

// 初始化统一响应机制
app.use(resextra)

app.use(compression()); // 开启 gzip

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
app.use(bodyParser.json({limit: '6mb'}))
app.use(bodyParser.urlencoded({ extended: true }))


const setDefaultHeader = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin)
  res.setHeader("Access-Control-Allow-Credentials", true);  
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, mytoken')
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Authorization')
  res.setHeader('Content-Type', 'application/json;charset=utf-8')
  res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization, Accept,X-Requested-With')
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS')
  res.header('X-Powered-By', ' 3.2.1')
  if (req.method == 'OPTIONS') { /*让options请求快速返回*/ 
    res.send(200)
  } else {
    next()
  }
}

// 设置跨域和相应数据格式
app.all('/api/*', setDefaultHeader)
// 路由加载
app.use('/api/album', albumRoutes) // 图册
app.use('/api/user', userRoutes) //  图册登录
app.use('/api/oil', oilRoutes) // 油价

const pathMap = [
  {reg: /dist\/product-manage\/hWz9nuJO91/, retFile: path.join(process.cwd(), 'hWz9nuJO91.txt')},
  {reg: /dist/, retFile: path.join(process.cwd(), 'dist/index.html')}, // 核心，这里返回前端首页
  {reg: /hWz9nuJO91/, retFile: path.join(process.cwd(), 'hWz9nuJO91.txt')},
  {reg: /tencent3622040499476384665/, retFile: path.join(process.cwd(), 'tencent3622040499476384665.txt')},
  {reg: /tencent12649019064503544745/, retFile: path.join(process.cwd(), 'tencent12649019064503544745.txt')},
  {reg: /tencent4971961837305385002/, retFile: path.join(process.cwd(), 'tencent4971961837305385002.txt')},
]

/**
 * 统一兜底处理
 */
app.use(function(req, res, next) {
  let matched = false
  for (const {reg, retFile} of pathMap) {
    if (reg.test(req.path)) {
      matched = true
      res.sendFile(retFile)
      break
    }
  }
  if (matched) return
  res.sendResult(null, 404, 'Not Found')
  // if (/dist/.test(req.path)) { // 核心，这里返回前端首页
  //   res.sendfile('./dist/index.html')
  // } else if (/hWz9nuJO91/.test(req.path)) {
  //   res.sendfile('./hWz9nuJO91.txt')
  // } else if (/tencent3622040499476384665/.test(req.path)) {
  //   res.sendfile('./tencent3622040499476384665.txt')
  // }else if (/tencent12649019064503544745/.test(req.path)) {
  //   res.sendfile('./tencent12649019064503544745.txt')
  // } else if (/tencent4971961837305385002/.test(req.path)) {
  //   res.sendfile('./tencent4971961837305385002.txt')
  // } else {
  //   res.sendResult(null, 404, 'Not Found')
  // }
})
app.listen(9000)