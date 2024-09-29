module.exports = function(db,callback){
	db.define("ProductModel",{
		id : {type: 'serial', key: true},
		shopId : Number,
    name: String,
    url: String,
    imgs: String,
    price: String,
    productType: String,
    desc: String,
    type3D: Number,
    model3D: Number,
    modelUrl: String,
    add_time : Number,
		upd_time : Number,
	},{
		table : "product",
	});
	return callback();
}