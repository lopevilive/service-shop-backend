module.exports = function(db,callback){
	// 用户模型
	db.define("GoodTypeModel",{
		id : {type: 'serial', key: true},
		type_name : String,
		is_del : Number,	// 0: 正常 , 1: 删除
		add_time : Number,
		upd_time : Number,
		delete_time : Number,
	},{
		table : "sp_good_type",
		methods: {
		getGoodsCat: function () {
			return this.id
		}
	}
	});
	return callback();
}