module.exports = function(db,callback){
	db.define("ShopModel",{
		id : {type: 'serial', key: true},
    userId: String,
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