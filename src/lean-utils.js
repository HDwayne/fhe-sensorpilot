var	path = require('path'),
    sensorConfig = require("jsonfile").readFileSync(path.join(__dirname, "../configs/sensorProtocol.json")),
    crc = require('crc'),
    StringDecoder = require('string_decoder').StringDecoder,
	  decoder = new StringDecoder('utf8'),
    pad = "0000";

module.exports.getBuffer = function(ordre, commande, data, callback){
	var tmp = data.toString();
	var crypt = function(str){
			var res = '';
			var ascii = str.toString(16);
			for(i=0; i<ascii.length; i++)
				res += '3'+ascii.charAt(i);
			return res;
		},
		taille = 11 + (tmp.length > 0 ? tmp.length : 1) * 2;


	//Stx
	var buffer = '02';

	//Longueur
	var tailleCrypted = crypt(taille);
	buffer += '30'.substring(0, 4 - tailleCrypted.length) + tailleCrypted;

	//Ordre
	buffer += sensorConfig.orders[ordre].value;

	//Commande
	buffer += sensorConfig.orders[ordre].commands[commande];

	//Data
	if(typeof(data) == 'number'){
		if(tmp.length % 2 != 0){
			buffer += crypt('0'+tmp);
		}
		else buffer += crypt(tmp);
	}
	else {
		if(data.length>0){
			for(i=0; i<data.length; i++){
				var ascii = data.charCodeAt(i).toString(16);
				buffer += '3'+ascii.charAt(0)+'3'+ascii.charAt(1);
			}
		}else buffer += '3030';
	}

	//CRC
	var bf = Buffer(buffer, "hex");
	calculCrc = ''+crc.crc16xmodem(bf).toString(16);
  calculCrc = pad.substring(0, pad.length - calculCrc.length) + calculCrc;
	buffer += crypt(calculCrc);

	//Etx
	buffer += '03';

	return callback(new Buffer(buffer, 'hex'));
}

module.exports.getBufferFromMaskedData = function(ordre, commande, data, callback){
	var crypt = function(str){
			var res = '';
			var ascii = str.toString(16);
			for(i=0; i<ascii.length; i++)
				res += '3'+ascii.charAt(i);
			return res;
		};

	//Stx
	var buffer = '02';
	//Longueur
	var tailleCrypted = crypt(11 + data.length / 2);
	buffer += '30'.substring(0, 4 - tailleCrypted.length) + tailleCrypted;

	//Ordre
	buffer += sensorConfig.orders[ordre].value;

	//Commande
	buffer += sensorConfig.orders[ordre].commands[commande];

	//Data
	buffer += data;

	//CRC
	var bf = Buffer(buffer, "hex");
	calculCrc = ''+crc.crc16xmodem(bf).toString(16);
  calculCrc = pad.substring(0, pad.length - calculCrc.length) + calculCrc;
	buffer += crypt(calculCrc);

	//Etx
	buffer += '03';
	return callback(new Buffer(buffer, 'hex'));
}

module.exports.decryptData = function(hexaStr, callback){
	var res = '';
	for(i=0;i<hexaStr.length;i+=4){
		var tmp = hexaStr[i+1]+hexaStr[i+3];
		if(tmp < '09')
			res += tmp.toString();
		else res += String.fromCharCode(parseInt(tmp, 16));
	}
	return callback(res);
}

module.exports.decodeData = function(hexaStr, callback){
	var hexaVal = '';
	for(i=1;i<=hexaStr.length;i+=2){
		hexaVal += hexaStr[i];
	}
	return parseInt(hexaVal, 16);
}

module.exports.decodeUnmaskedData = function(buffer, callback){
	return callback(decoder.write(buffer));
}
