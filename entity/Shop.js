
module.exports = {
  name: 'Shop',
  columns: {
    id: {type: 'int', generated: true, primary: true},
    userId: {type: 'int'}, // 创建者
    name: {type: 'varchar'},
    desc: {type: 'varchar'},
    url: {type: 'text'},
    area: {type: 'varchar'},
    address: {type: 'varchar'},
    phone: {type: 'varchar'},
    qrcodeUrl: {type: 'varchar'},
    attrs: {type: 'text', nullable: true}, // 配置的属性历史
    specCfg: {type: 'varchar', nullable: true}, // 配置的规格历史
    level: {type: 'int',default: 0}, // 等级
    expiredTime: {type: 'int',default: 0}, // 过期时间
    status: {type: 'int',default: 0}, // 0-正常、1-封禁状态
    auditing: {type: 'int',default: 0}, // 图片审核策略 0-默认、1-概率审核、2-持续审核、99-永久放过
    encry: {type: 'int',default: 0}, // 0-正常、1-加密
    encryCode: {type: 'int',default: 0}, // 加密密码
    waterMark: {type: 'int', default: 0}, // 是否开启水印 0-不开启、1-开启
    addressStatus: {type: 'int', default: 0}, // 是否必填地址 0-否、1-必填
    inveExportStatus: {type: 'int', default: 0}, // 用户能否导出清单 0-能、1-否
    bannerStatus: {type: 'int', default: 0}, // 是否开启首页轮播 0-否、1-是
    bannerCfg: {type: 'text', nullable: true},// banner 配置信息
    requiredType: {type: 'varchar', nullable: true} , // 必选分类
    typeStatus: {type: 'int', default: 0}, // 若为 1，产品分类导航栏中的‘全部’标签页将被隐藏
    forwardPermi: {type: 'int', default: 0}, // 若为 1， 则仅管理员才可以转发
    business: {type: 'int', nullable: true},
    add_time: {type: 'int', nullable: true},
    upd_time: {type: 'int', nullable: true},
  }
}