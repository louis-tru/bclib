#!/usr/bin/env node
/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

// 导入数据到 license_types ccl 链是

require('./_');

var somes = require('somes').default;
var request = require('somes/request');
var xlsx = require('node-xlsx');

class SignerIMPL {
	sign(path, data) {
		// console.log(path, data);
		return {};
	}
}

class Request extends request.Request {

	constructor(url) {
		super(url);
		this.urlencoded = false;
		this.signer = new SignerIMPL();
	}

	parseResponseData(buf) {
		var res = request.parseJSON(buf.toString('utf8'));
		if (res.errno === 0) {
			return res.data;
		} else {
			throw Error.new(res);
		}
	}

}

var req = new Request('http://127.0.0.1:8000/service-api');

async function resolve() {

	var table = xlsx.parse(process.argv[2])[0].data;

	table.shift();

	console.log('start import license_types, total:', table.length);

	var send_total = 0;

	for (var item of table) {

		var [
			certificate_type_name,
			certificate_type_name_code,
			certificate_define_authority_name,
			certificate_define_authority_code,
			certificate_holder_type_name,
			shared_province,
		] = item;

		somes.assert(certificate_type_name_code);

		var args = {
			certificate_type_name,
			certificate_type_name_code,
			certificate_define_authority_name,
			certificate_define_authority_code,
			certificate_holder_type_name,
			shared_province: shared_province.split(/\s*,\s*/),
		};

		// http://127.0.0.1:8000/service-api/license_types/get?certificate_type_name_code=11100000000019713D008

		var r = await req.post('license_types/get', {certificate_type_name_code});

		if (!r.data.certificate_type_name) {

			console.log('set:', send_total++, certificate_type_name_code);

			await req.post('license_types/set', args);
		}

	}

	console.log(`~ import license_types ok send_total = ${send_total} ~`);
}

resolve();
