const path = require("path");
const weekDays = require('./weekDays');
const calcuOilPrice = require('./calcuOilPrice')
const util  = require('./util')

module.exports = { ...weekDays, ...calcuOilPrice,  ...util }
