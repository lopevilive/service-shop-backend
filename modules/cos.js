const STS = require('qcloud-cos-sts')
const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const COS = require('cos-nodejs-sdk-v5');

// 配置参数
const config = {
  secretId: util.getConfig("secretId"), // 固定密钥
  secretKey: util.getConfig("secretKey"), // 固定密钥
  proxy: '',
  durationSeconds: 7200,
  host: 'xiaoguo.afxa.cn', // 域名，非必须，默认为 sts.tencentcloudapi.com
  // endpoint: 'sts.tencentcloudapi.com', // 域名，非必须，与host二选一，默认为 sts.tencentcloudapi.com

  // 放行判断相关参数
  bucket: 'upload-1259129443',
  region: 'ap-guangzhou',
  allowPrefix: '*', // 这里改成允许的路径前缀，可以根据自己网站的用户登录态判断允许上传的具体路径，例子： a.jpg 或者 a/* 或者 * (使用通配符*存在重大安全风险, 请谨慎评估使用)
  // 简单上传和分片，需要以下的权限，其他权限列表请看 https://cloud.tencent.com/document/product/436/31923
  allowActions: [
      // 简单上传
      'name/cos:PutObject',
      'name/cos:PostObject',
      // 分片上传
      'name/cos:InitiateMultipartUpload',
      'name/cos:ListMultipartUploads',
      'name/cos:ListParts',
      'name/cos:UploadPart',
      'name/cos:CompleteMultipartUpload'
  ],
};



 module.exports.getTempKeys = async () => {
   // 获取临时密钥
  var shortBucketName = config.bucket.substr(0 , config.bucket.lastIndexOf('-'));
  var appId = config.bucket.substr(1 + config.bucket.lastIndexOf('-'));
  var policy = {
      'version': '2.0',
      'statement': [{
          'action': config.allowActions,
          'effect': 'allow',
          'principal': {'qcs': ['*']},
          'resource': [
              'qcs::cos:' + config.region + ':uid/' + appId + ':prefix//' + appId + '/' + shortBucketName + '/' + config.allowPrefix,
          ],
          // condition生效条件，关于 condition 的详细设置规则和COS支持的condition类型可以参考https://cloud.tencent.com/document/product/436/71306
          // 'condition': {
          //   // 比如限定ip访问
          //   'ip_equal': {
          //     'qcs:ip': '10.121.2.10/24'
          //   }
          // }
      }],
  };
  const res = await new Promise((resolve, reject) => {
    STS.getCredential({
      secretId: config.secretId,
      secretKey: config.secretKey,
      proxy: config.proxy,
      durationSeconds: config.durationSeconds,
      endpoint: config.endpoint,
      policy: policy,
    }, function (err, tempKeys) {
      if (err) reject(err)
      else resolve(tempKeys)
    });
  })
  return res
 }

module.exports.cosInstance = new COS({
  SecretId: config.secretId, // 推荐使用环境变量获取；用户的 SecretId，建议使用子账号密钥，授权遵循最小权限指引，降低使用风险。子账号密钥获取可参考https://cloud.tencent.com/document/product/598/37140
  SecretKey: config.secretKey, // 推荐使用环境变量获取；用户的 SecretKey，建议使用子账号密钥，授权遵循最小权限指引，降低使用风险。子账号密钥获取可参考https://cloud.tencent.com/document/product/598/37140
});

