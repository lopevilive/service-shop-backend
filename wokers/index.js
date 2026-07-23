const path = require("path");
const util = require(path.join(process.cwd(),"util/index"))

module.exports.fnMap = {
  batchUpload: async (payload) => {
    const { processBatchUploadInstance } = require(path.join(process.cwd(),"modules/batchUploadHandle"))
    const ret = await processBatchUploadInstance.run(payload)
    return ret
  }
}

module.exports.run = async (fnName, payload) => {
  const env = util.getConfig('default.env')
  if (['test', 'prod'].includes(env)) {
  // if (['test', 'prod', 'dev'].includes(env)) {
    console.log('scf')
    const tencentcloud = require("tencentcloud-sdk-nodejs");
    const ScfClient = tencentcloud.scf.v20180416.Client;
    const client = new ScfClient({
      credential: {
        secretId: util.getConfig("default.cloudApiKey.secretId"),
        secretKey: util.getConfig("default.cloudApiKey.secretKey"),
      },
      region: "ap-guangzhou", // 强制固定指向广州事件函数所在的机房
      profile: {}
    });
    const ret = await client.Invoke({
      FunctionName: 'test',
      Namespace: 'default',
      // InvocationType: 'Event',
      InvocationType: 'RequestResponse',
      ClientContext: JSON.stringify({ fnName, payload })
    })
    console.log(ret, 'scfRet')
    return ret?.RequestId || ''
  } else {
    console.log('loacl')
    const workerEntry = require(path.join(process.cwd(), "wokerEntry"))
    workerEntry.main_handler({ fnName, payload })
    return 'a770eae5-15e9-474a-aef8-d2608cbf40b1'
  }

}