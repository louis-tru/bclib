/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from 'somes';
import req, {Params,Options, PromiseResult, parseJSON as _parseJSON, Result} from 'somes/request';
import errno from './errno';
import {IBuffer} from 'somes/buffer';
import './log';

const crypto = require('crypto-tx');

const config = utils.config;
const internet_test = [
	'http://www.apple.com/',
];

export const parseJSON = _parseJSON;

if (Array.isArray(config.internetTest)) {
	config.internet_test.forEach((e:any)=>internet_test.indexOf(e)==-1&&internet_test.push(e));
}

type RequestArgs = [string, string?, Params?, Options?];
type RequestItem = [ SafeRequest, RequestArgs, (any: any)=>void, (any: any)=>void ];

/**
 * @class CheckSafeInternet
 */
class CheckSafeInternet {

	private m_internet_available: number = 0;
	private m_check_internet_flag: number = 0;
	private m_check_internet_time: number = 0;
	private m_request_list: RequestItem[] = [];

	private resolve_request_list() {
		var self = this;
		if (self.m_request_list.length) {
			var list = self.m_request_list;
			self.m_request_list = [];
			list.forEach(([safe, args, ok, err])=>{
				safe._sendRequest(...args).then(ok).catch(err);
			});
		}
	}
	
	private async check_internet(urls: string[]): Promise<void> {
		var self = this; // CheckSafeInternet, 
		try {
			await req.get(urls.shift() as string, { timeout: 1e4 });
			self.m_check_internet_flag = 2;
			self.m_check_internet_time = Date.now();
			self.m_internet_available = 1;
		} catch(err) {
			console.log('check_internet error');
			if (urls.length) {
				await self.check_internet(urls);
			} else {
				self.m_check_internet_flag = 2;
				self.m_check_internet_time = Date.now();
				self.m_internet_available = 0;
				self.resolve_request_list();
				throw err;
			}
			return;
		}
		self.resolve_request_list();
	}
	
	checkInternet(): Promise<void> {
		this.m_check_internet_flag = 1;
		if (internet_test.length)
			return this.check_internet(internet_test.slice());
		else 
			return Promise.resolve();
	}

	get internetAvailable(): boolean {
		return this.m_internet_available !== 0;
	}

	request(safe: SafeRequest, args: RequestArgs): PromiseResult {
		return new Promise((ok, err)=>{
			if (this.m_check_internet_flag == 2) {
				if (this.m_internet_available) {
					// auto check internet
					if (Date.now() - this.m_check_internet_time > 3e5/*300s*/) {
						this.m_request_list.push([safe, args, ok, err]);
						this.checkInternet();
					} else {
						safe._sendRequest(...args).then(ok).catch(err);
					}
				} else {
					// auto check internet
					if (Date.now() - this.m_check_internet_time > 3e4/*30s*/) {
						this.m_request_list.push([safe, args, ok, err]);
						this.checkInternet();
					} else {
						// Error.prototype
						err(Error.new(errno.ERR_INTRRNET_NOT_AVAILABLE));
					}
				}
			} else if (this.m_check_internet_flag == 1) {
				this.m_request_list.push([safe, args, ok, err]);
			} else {
				this.m_request_list.push([safe, args, ok, err]);
				this.checkInternet();
			}
		});
	}

}

var G_chack = new CheckSafeInternet();

/**
 * @class SafeRequest
 */
export class SafeRequest extends req.Request {

	private m_chack = G_chack;

	parseResponseData(buf: IBuffer, r: Result): any {
		if (r.statusCode != 200) {
			throw Error.new(errno.ERR_HTTP_STATUS_NO_200);
		}
		var json = buf.toString('utf8');
		var res = JSON.parse(json);
		if (res.code == 200) {
			return res.data;
		} else {
			res.errno = res.code;
			res.message = res.message || res.error || res.msg;
			throw Error.new(res);
		}
	}

	checkInternet(): Promise<void> {
		return this.m_chack.checkInternet();
	}

	get internetAvailable(): boolean {
		return this.m_chack.internetAvailable;
	}

	async _sendRequest(
		name: string, 
		method: string = 'GET',
		params?: Params, 
		options?: Options,
	): PromiseResult {
		params = params || {};
		options = options || {};

		// sign request
		var st = Date.now();
		var key = 'a4dd53f2fefde37c07ac4824cf7086439633e1a357daacc3aaa16418275a9e40';
		if (method == 'POST') {
			var hash32Hex = crypto.keccak(JSON.stringify(params) + st + key).hex;
		} else {
			var hash32Hex = crypto.keccak(st + key).hex;
		}
		var headers = Object.assign({
			st: st,
			// sign: await hw.call('sign', { hash32Hex }),
		}, options.headers);

		options.headers = headers;

		// recover public key test:
		// var msg = Buffer.from(hash32Hex.slice(2), 'hex');
		// var signature = Buffer.from(options.headers.sign, 'base64');
		// var pkey = crypto.recover(msg, signature.slice(0, 64), signature[64]).toString('hex');
		// console.log('sign confirm dev', '0x'+ pkey);

		return await super.request(name, method, params, options);
	}

	request(
		name: string,
		method?: string,
		params?: Params,
		options?: Options): PromiseResult {
		return this.m_chack.request(this, [name, method, params, options]);
	}

	get(
		name: string, 
		params?: Params, 
		options?: Options
	): PromiseResult {
		return super.get(name, params, options);
	}

	post(
		name: string, 
		params?: Params, 
		options?: Options,
	): PromiseResult {
		return super.post(name, params, options);
	}

}

export class XApi extends SafeRequest {

	getRequestHeaders() {
		return {
			'x-api-key': config.x_api_key,
		};
	}

	parseResponseData(buf: IBuffer, r: Result): any {
		if (r.statusCode != 200) {
			throw Error.new(errno.ERR_HTTP_STATUS_NO_200);
		}
		return JSON.parse(buf.toString('utf8')).payload;
	}

}

export const get = req.get;
export const request = req.request;

export const chain = new SafeRequest(config.chain);
export const btc = new XApi(config.x_api + '/btc/mainnet');

chain.urlencoded = false;
chain.timeout = 5e4; // 50s
btc.urlencoded = false;
btc.timeout = 5e4;

export default chain;