const STS = require('qcloud-cos-sts')
const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))
const COS = require('cos-nodejs-sdk-v5');
const dao = require(path.join(process.cwd(),"dao/DAO"));
const wxApi = require(path.join(process.cwd(),"modules/wxApi"))

// 配置参数
const config = {
  secretId: util.getConfig("default.cos.secretId"), // 固定密钥
  secretKey: util.getConfig("default.cos.secretKey"), // 固定密钥
  proxy: '',
  durationSeconds: 7200,
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
      'name/cos:InitiateMultipartUpload',
      'name/cos:ListMultipartUploads',
      'name/cos:ListParts',
      'name/cos:UploadPart',
      'name/cos:CompleteMultipartUpload',
      // 必须增加以下三个 CI 权限动作
      'name/ci:CreateMediaJobs',     // 对应文档中的“提交任务”
      'name/ci:GetMediaJob',         // 用于查询任务结果
      'name/ci:CloudImageProcess'    // 兼容原有的图片处理
  ],
};

module.exports.cfg = config

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
        // 1. COS 资源授权 (保持你原来的)
        'qcs::cos:' + config.region + ':uid/' + appId + ':' + config.bucket + '/' + config.allowPrefix,
        
        // 2. CI 任务流授权 (解决你现在的报错)
        // 必须显式授权到 bucket 级别下的 job 路径
        'qcs::ci:' + config.region + ':uid/' + appId + ':bucket/' + config.bucket + '/job/*',
        
        // 3. CI 对象处理授权
        // 确保 CI 引擎有权读取和写入存储桶里的文件
        'qcs::ci:' + config.region + ':uid/' + appId + ':bucket/' + config.bucket + '/object/*'
    ],
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


module.exports.getImageAuditing = async (fileName) => {
  let resolve;
  let reject;
  const p = new Promise((a, b) => {
    resolve = a
    reject = b
  })
  
  this.cosInstance.request({
    Bucket: config.bucket,
    Region: config.region,
    Method: 'GET',
    Key: fileName,
    Query: {
      'ci-process': 'sensitive-content-recognition', // 固定值，必须
      'biz-type': 'd0a0f625e85011efa07c525400b75156', // 审核类型，非必须
      'interval': 5, // 审核 GIF 动图时，每隔 interval 帧截取一帧，非必须
      'max-frames': 5,  // 审核 GIF 动图时，最大截帧数，非必须
      'large-image-detect': 1, // 是否需要压缩图片后再审核，非必须
    }
  }, (err, data) => {
    if (err) {
      reject(err)
    } else {
      resolve(data)
    }
  })

  return p
}

module.exports.ProcessVideo = class ProcessVideo {
  constructor(payload) {
    const {shopId, rawKey, userInfo, shopInfo} = payload
    this.shopId = shopId
    this.rawKey = rawKey;
    this.userInfo = userInfo;
    this.shopInfo = shopInfo
    this.videoInfo = null
    this.transcodeKey = rawKey.replace(/raw_/, 'trans_').replace(/\.[^.]+$/, '.mp4');
    this.snapshotKey = rawKey.replace(/raw_/, 'cover_').replace(/\.[^.]+$/, '.jpg');
    this.checkKey = this.transcodeKey.replace(/\.[^.]+$/, '.check')
    this.imgList = [] // 批量截图key
    this.snapRet = null // 批量截图任务返回

  }

  // 这里把视频做转换，统一转.mp4 & 截取首贞
  async transHandle () {
    const url = `https://${config.bucket}.ci.${config.region}.myqcloud.com/jobs`;
    // 构建合并任务的 XML 体
    const body = COS.util.json2xml({
      Request: {
        Tag: 'Animation', // 使用多任务标签
        Input: { Object: this.rawKey },
        Operation: [
          // 子任务一：转码为 H.264 MP4
          {
            Tag: 'Transcode',
            Output: {
              Region: config.region,
              Bucket: config.bucket,
              Object: this.transcodeKey
            },
            Transcode: {
              Container: { Format: 'mp4' },
              Video: {
                Codec: 'H.264',
                Profile: 'high',       // 启用高阶压缩配置，同等体积下画质细节更细腻（家具木纹、皮质尤为明显）
                LongEdge: '1280',      // 强行锁死长边最大 1280。横屏则宽1280，竖屏则高1280，短边自动等比缩放
                
                // 💥 锁死码率双保险组合拳：
                Crf: '24',             // 恒定质量因子，24 是兼顾体积与小屏清晰度的“业界公认黄金值”
                Bitrate: '1500',       // 封顶最高码率 1500kbps (1.5Mbps)，防止极个别复杂动态画面导致体积失控
                Bufsize: '3000',       // 缓冲区大小
                Maxrate: '2000'        // 峰值码率限制
              },
              // 核心修复：显式配置音频参数，保留并转码音频轨道
              Audio: {
                Codec: 'aac',         // 必须是 aac，移动端和微信 H5 兼容性最好
                Samplerate: '44100',  // 采样率，标准 CD 级音质
                Bitrate: '128',       // 音频比特率 (单位: kbps)
                Channels: '2'         // 双声道
              }
            }
          },
          // 子任务二：单张截图
          {
            Tag: 'Snapshot',
            Output: {
              Region: config.region,
              Bucket: config.bucket,
              Object: this.snapshotKey
            },
            Snapshot: {
              Time: '1',        // 截取第 1 秒
              Format: 'jpg',
              Mode: 'Interval',
              Count: '1'        // 必须传，解决之前的 empty 报错
            }
          }
        ]
      }
    });

    return new Promise((resolve, reject) => {
      module.exports.cosInstance.request({
        Method: 'POST', Key: 'jobs', Url: url, Body: body, ContentType: 'application/xml',
      }, (err, data) => {
        if (err) {
          console.error('云端合并任务提交失败:', err);
          reject(err);
        } else {
          // 返回任务信息，包含 JobId 等
          resolve(data);
        }
      });
    });
  }

  async getVideoInfo () {
    if (this.videoInfo) return this.videoInfo
    const ret = await new Promise((resolve, reject) => {
      module.exports.cosInstance.request({
        Bucket: config.bucket,
        Region: config.region,
        Method: 'GET',
        Key: this.rawKey,
        Query: { 'ci-process': 'videoinfo' }
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data.Response.MediaInfo);
      });
    });
    this.videoInfo = ret;
    return this.videoInfo
  }

  /**
  * 截图
  * preSec 是多少秒截一次图。首贞跟尾贞要截上
  */
  async snapshotList (preSec = 1) {
    try {
      // 1. 获取视频时长
      const videoInfo = await this.getVideoInfo()
      const duration = parseFloat(videoInfo.Format.Duration) || 0;

      if (duration <= 0) {
        throw new Error('无法获取视频时长');
      }

      // 2. 计算截图数量
      const count = Math.ceil(duration / preSec);
      const snapshotBaseKey = this.rawKey
        .replace(/raw_/, 'snapshot_')
        .replace(/\.[^.]+$/, '');

      // 3. 使用批量截图接口
      const body = COS.util.json2xml({
        Request: {
          Tag: 'Snapshot',
          Input: { Object: this.rawKey },
          Operation: {
            Output: {
              Region: config.region,
              Bucket: config.bucket,
              Object: `${snapshotBaseKey}_\${Number}.jpg`
            },
            Snapshot: {
              Format: 'jpg',
              Mode: 'Interval',
              Start: '0',           // 从0秒开始
              Interval: preSec.toString(),  // 间隔秒数
              Count: count.toString(),      // 截图数量
              Width: '640',          // 可选：指定宽度
            }
          }
        }
      });

      this.snapRet = await new Promise((resolve, reject) => {
        module.exports.cosInstance.request({
          Method: 'POST',
          Key: 'jobs',
          Url: `https://${config.bucket}.ci.${config.region}.myqcloud.com/jobs`,
          Body: body,
          ContentType: 'application/xml',
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      // 4. 截图文件 Key 列表
      // 注意：批量截图会生成类似 snapshot_0.jpg, snapshot_1.jpg... 的文件
      for (let i = 0; i < count; i++) {
        this.imgList.push(`${snapshotBaseKey}_${i}.jpg`);
      }
    } catch (error) {
      console.error('批量截图失败:', error);
      throw error;
    }
  }

  async createCheckTask () {
    const {rawKey} = this
    const content = { taskList: [] }
    for (const imgKey of this.imgList) {
      content.taskList.push({ key: imgKey, checkRes: {}, trace_id: '', checkStatus: 'pending'})
    }
    const jobId = this?.snapRet?.Response?.JobsDetail?.JobId;
    dao.create('XaCache', { dataType: 16, add_time: util.getNowTime(), content: JSON.stringify(content), key1: rawKey, key2: jobId })
  }

  // 执行审核任务，主要是调微信的异步审核接口，异步结果处理不在此处
  async checkSnapStatus () {
    // 1. 提取 JobId
    const jobId = this?.snapRet?.Response?.JobsDetail?.JobId;
    // 2. 轮询配置
    const maxAttempts = 60; // 最多轮询60次
    const intervalMs = 1000; // 每1秒轮询一次
    let attempts = 0;
    let isCompleted = false;
    let status = 0; // 0-轮询中、1-任务完成、2-任务失败、3-轮询超时、4-轮询出错
    // 3. 轮询任务
    while (attempts < maxAttempts && !isCompleted) {
      attempts++;
      try {
        // 查询任务状态
        const jobStatus = await new Promise((resolve, reject) => {
          module.exports.cosInstance.request({
            Method: 'GET', Key: `jobs/${jobId}`,
            Url: `https://${config.bucket}.ci.${config.region}.myqcloud.com/jobs/${jobId}`,
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data.Response.JobsDetail);
          });
        });
        // 4. 检查任务状态
        switch (jobStatus.State) {
          case 'Success':
            status = 1;
            isCompleted = true;
            break;
          case 'Failed':
            status = 2;
            dao.create('XaCache', {dataType: 17, add_time: util.getNowTime(), key1: rawKey, content: JSON.stringify({
              jobId, msg: jobStatus?.Message || '未知错误'
            })})
            isCompleted = true;
            break;
          case 'Submitted':
          case 'Running':
            // 等待下次轮询
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            break;
          default:
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            break;
        }
      } catch (error) {
        console.error(`轮询出错 (尝试 ${attempts}/${maxAttempts}):`, error);
        if (attempts >= maxAttempts) {
          status = 4
          dao.create('XaCache', {dataType: 18, add_time: util.getNowTime(), key1: rawKey, content: JSON.stringify({
            jobId, msg: error.message || '未知错误'
          })})
          isCompleted = true;
        } else {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
    }
    // 5. 超时处理
    if (!isCompleted && attempts >= maxAttempts) {
      dao.create('XaCache', {dataType: 19, add_time: util.getNowTime(), key1: rawKey, content: JSON.stringify({ jobId, msg: '轮询超时' })})
      status = 3
    }
    return status
  }

  async startCheckTask () {
    const jobId = this?.snapRet?.Response?.JobsDetail?.JobId;
    const manager = await dao.getManager()
    await manager.transaction(async (transactionalEntityManager) => {
      const instance = await transactionalEntityManager.createQueryBuilder('XaCache', 'XaCache')
      instance.setLock('pessimistic_write')
      instance.where('XaCache.dataType = 16')
      instance.andWhere('XaCache.key2 = :jobId', {jobId})
      const data = await instance.getOne()
      if (!data) throw new Error(`找不到jobId:${jobId}`)
      const content = JSON.parse(data.content)
      const {taskList} = content
      const {appid, secret} = util.getConfig('album.appInfo')
      const openid = this.userInfo.openid
      const {bucket, region} = config
      for (const item of taskList) {
        const media_url = `https://${bucket}.cos.${region}.myqcloud.com/${item.key}?imageMogr2/quality/70/thumbnail/800x/strip`
        const trace_id = await wxApi.mediaSecCheck({openid, appid, secret, media_url})
        util.secCheckCount(6)
        // const trace_id = '6965ef8b-628096bc-2190c0ef'
        item.trace_id = trace_id
        dao.create('XaCache', {dataType: 10, add_time: util.getNowTime(), key1: trace_id, content: JSON.stringify({
          type: 1 << 3,
          req: {key: item.key, jobId},
          res: {}
        })})
      }
      await transactionalEntityManager.update('XaCache', {id: data.id}, {
        upd_time: util.getNowTime(),content: JSON.stringify(content)
      })
    })
  }

  // 检测是否需要创建审核任务，比如避免重复创建
  async isNeedCheck() {
    const {rawKey} = this
    const list = await dao.list('XaCache', {columns: {key1: rawKey, dataType: 16}})
    if (list.length) return false
    return true
  }
  
  async run() {
    try {
      if (!this.rawKey) throw new Error('参数有误');
      const pass = await this.isNeedCheck()
      if (!pass) return // 可能是有相同的视频在审核中
      await this.transHandle() // 把视频转.mp4 和截首贞
      await this.snapshotList() // 异步截图
      await this.createCheckTask() // 创建审核任务
      const status = await this.checkSnapStatus()  // 检查异步截图任务是否完成
      if (status === 1) {
        await this.startCheckTask()
      }
    } catch(e) {
      dao.create('XaCache', {dataType: 16, add_time: util.getNowTime(), content: JSON.stringify({
        rawKey: this.rawKey || '-',
        msg: e.message || '未知错误'
      })})
    }
  }

  // 视频预检测
  async videoPreCheck () {
    const videoInfo = await this.getVideoInfo()
    const duration = Math.floor(videoInfo.Format.Duration) || 0;
    const cfg = util.getConfig('album.levelCfg')
    const {level} = this.shopInfo
    const matchItem = cfg.find((item) => item.level === level)
    if (!matchItem) throw new Error('参数有误，请联系管理员~')
    const { videoS } = matchItem
    if (duration > videoS) { // 超出时长
      return { status: 1, duration }      
    }
    return {status: 0}
  }

  async getData () {
    const {bucket, region} = config
    const ret = await this.videoPreCheck()
    if (ret.status === 0) {
      this.run()
      ret.key = `https://${bucket}.cos.${region}.myqcloud.com/${this.checkKey}`
      return ret
    } else {
      return ret
    }
  }


}

/**
 * 封装媒体文件删除方法（新增）
 * @param {String|Array} keys - 可以传入单个文件Key字符串，或多个文件Key组成的数组
 */
module.exports.deleteMedia = async (keys) => {
  if (!keys || (Array.isArray(keys) && keys.length === 0)) {
    return { message: 'Keys 不能为空' };
  }

  // 场景一：如果是数组，调用腾讯云原生的批量删除接口 deleteMultipleObject
  if (Array.isArray(keys)) {
    const objects = keys.filter(Boolean).map(key => ({ Key: key }));
    return new Promise((resolve, reject) => {
      this.cosInstance.deleteMultipleObject({
        Bucket: config.bucket,
        Region: config.region,
        Objects: objects
      }, (err, data) => {
        if (err) {
          console.error('COS 批量删除失败:', err);
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  // 场景二：如果是单字符串，调用普通单文件删除接口 deleteObject
  return new Promise((resolve, reject) => {
    this.cosInstance.deleteObject({
      Bucket: config.bucket,
      Region: config.region,
      Key: keys
    }, (err, data) => {
      if (err) {
        console.error(`COS 单文件删除失败 [${keys}]:`, err);
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};


