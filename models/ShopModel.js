module.exports = function(db,callback){
	// 用户模型
	db.define("ShopModel",{
		id : {type: 'serial', key: true},
		name : String,
    desc: String,
    logo: String,
		add_time : Number,
		upd_time : Number,
	},{
		table : "shop",
	});
	return callback();
}