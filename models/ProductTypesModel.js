module.exports = function(db,callback){
	db.define("ProductTypesModel",{
		id : {type: 'serial', key: true},
		shopId : Number,
    name: String,
    add_time : Number,
		upd_time : Number,
	},{
		table : "product_types",
	});
	return callback();
}