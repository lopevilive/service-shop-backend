module.exports = function(db,callback){
	// 用户模型
	db.define("GoodModel",{
		id : {type: 'serial', key: true},
		good_name : String,
    good_type: Number, // 所属分类
    good_pics: Object, // 商品图片 array
    good_specs: Object, // 商品规格 json 格式
		is_del : Number,	// 0: 正常 , 1: 删除
		add_time : Number,
		upd_time : Number,
		delete_time : Number,

	},{
		table : "sp_goods",
		methods: {
		getGoodsCat: function () {
			return this.cat_one_id + ',' + this.cat_two_id + ',' + this.cat_three_id;
		}
	}
	});
	return callback();
}