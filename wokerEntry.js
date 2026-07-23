const path = require("path");

module.exports.main_handler = async (event, context) => {
  const {fnName, payload} = event
  if (!fnName) return null
  const { fnMap } = require(path.join(process.cwd(),"wokers/index"))
  const fn = fnMap[fnName]
  if (!fn) return null
  const ret = await fn(payload)
  console.dir(ret, {depth: null, colors: true})
  console.log('done')
};