/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2018-06-13
 */

import * as rng from 'somes/rng';
import * as crypto from 'crypto';
import req, {Params,Options, PromiseResult, parseJSON as _parseJSON, Result} from 'somes/request';
import errno from './errno';
import buffer, {IBuffer} from 'somes/buffer';
import keys from './keys+';
import {SecretKey} from 'bclib/keys';
import cfg from './cfg';

const crypto_tx = require('crypto-tx');

const internet_test = [
	'http://files.dphotos.com.cn/test.txt', 
	'http://www.apple.com/',
];

export const parseJSON = _parseJSON;

if (cfg.internetTest && Array.isArray(cfg.internetTest)) {
	cfg.internetTest.forEach((e:any)=>internet_test.indexOf(e)==-1&&internet_test.push(e));
}

type RequestArgs = [string, string?, Params?, Options?];
type RequestItem = [ SafeRequest, RequestArgs, (any: any)=>void, (any: any)=>void ];

/**
 * @class CheckInternet
 */
class CheckInternet {

	private m_internet_available: number = 0;
	private m_check_internet_flag: number = 0;
	private m_check_internet_time: number = 0;
	private m_request_list: RequestItem[] = [];

	private resolve_request_list<T>() {
		var self = this;
		if (self.m_request_list.length) {
			var list = self.m_request_list;
			self.m_request_list = [];
			list.forEach(([safe, args, ok, err])=>{
				safe.sendSignRequest<T>(...args).then(ok).catch(err);
			});
		}
	}
	
	private async check_internet(urls: string[]): Promise<void> {
		var self = this; // CheckInternet, 
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
		return this.check_internet(internet_test.slice());
	}

	get internetAvailable(): boolean {
		return this.m_internet_available !== 0;
	}

	request<T>(safe: SafeRequest, args: RequestArgs): PromiseResult<T> {
		return new Promise((ok, err)=>{
			if (this.m_check_internet_flag == 2) {
				if (this.m_internet_available) {
					// auto check internet
					if (Date.now() - this.m_check_internet_time > 3e5/*300s*/) {
						this.m_request_list.push([safe, args, ok, err]);
						this.checkInternet();
					} else {
						safe.sendSignRequest<T>(...args).then(ok).catch(err);
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

var CHECK = new CheckInternet();

/**
 * @class SafeRequest
 */
export abstract class SafeRequest extends req.Request {

	private _chack = CHECK;
	protected shareKey = 'a4dd53f2fefde37c07ac4824cf7086439633e1a357daacc3aaa16418275a9e40';

	abstract parseResponseData(buf: IBuffer, r: Result): any;

	checkInternet(): Promise<void> {
		return this._chack.checkInternet();
	}

	get internetAvailable(): boolean {
		return this._chack.internetAvailable;
	}

	protected async sign(hash32Hex: string) {
		var signature = await keys.impl.sign(buffer.from(hash32Hex.slice(2), 'hex'), keys.impl.defauleAddress);
		return buffer.concat([signature.signature, [signature.recovery]]).toString('base64');
	}

	async sendSignRequest<T>(
		name: string, 
		method?: string,
		params?: Params, 
		options?: Options,
	): PromiseResult<T> {
		params = params || {};
		options = options || {};

		// sign request
		var st = Date.now();
		var key = this.shareKey;
		if (method == 'POST') {
			var hash32Hex = crypto_tx.keccak(JSON.stringify(params) + st + key).hex;
		} else {
			var hash32Hex = crypto_tx.keccak(st + key).hex;
		}
		var headers = Object.assign({
			st: st,
			sign: await this.sign(hash32Hex),
		}, options.headers);

		options.headers = headers;

		// recover public key test:
		// var msg = Buffer.from(hash32Hex.slice(2), 'hex');
		// var signature = Buffer.from(options.headers.sign, 'base64');
		// var pkey = crypto.recover(msg, signature.slice(0, 64), signature[64]).toString('hex');
		// console.log('sign confirm dev', '0x'+ pkey);

		return await super.request<T>(name, method, params, options);
	}

	request<T>(
		name: string,
		method?: string,
		params?: Params,
		options?: Options) {
		return this._chack.request<T>(this, [name, method, params, options]);
	}

}

class Chain extends SafeRequest {

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
}

class Dasset extends SafeRequest {

	private _token?: { token: string; expire_time: number };

	private async _getToken(): Promise<string> {
		if (!this._token) {
			var nonce = rng.rng16().toString('base64');
			var key = cfg.dasset_appid + nonce + cfg.dasset_secret_key;
			var sign = crypto.createHash('sha256').update(key).digest('hex');
			var {data} = await super.sendSignRequest<{ token: string; expire_time: number }>('auth/getAccessToken', 'POST',
				{ nonce, sign, alg: 'sha256' }, { headers: { appid: cfg.dasset_appid }
			});
			// "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJqd19hcGkiLCJpYXQiOjE2MTAwMDczNTEsImV4cCI6MTYxMD\
			// A5Mzc1MSwibmJmIjoxNjEwMDA3MzUxLCJzaWQiOiJmYTE3OGc3cG9udjBmbWc3MG92Y2dsY2RxYSIsImlwIjoiMTI3LjAuMC4xIiwiYWlk\
			// IjoiMTAwMyIsImFjYyI6IiIsImNpZCI6IiIsInVpZCI6IiJ9.qJr6UES4AFsoub_gxmOmulp40zOwNiJSU3rg1AHb97Q",
			// "expire_time": 1610093751
			this._token = data;
		}
		return this._token.token;
	}

	async sendSignRequest<T>(
		name: string, 
		method?: string,
		params?: Params, 
		options?: Options,
	): PromiseResult<T> {
		params = params || {};
		options = options || {};

		options.headers = Object.assign({
			appid: cfg.dasset_appid,
			token: await this._getToken(),
		}, options.headers);

		try {
			return await super.sendSignRequest(name, method, params, options);
		} catch(err) {
			// C-10005 Token错误,请重新登录或重新获取Token
			if (err.errno != errno.ERR_REQ_DASSET_ERR[0] || err.state != 'C-10005') {
				throw err;
			}
			this._token = undefined;
		}
		// use new token retry
		options.headers.token = await this._getToken();
		return await super.sendSignRequest<T>(name, method, params, options);
	}

	parseResponseData(buf: IBuffer, r: Result): any {
		if (r.statusCode != 200) {
			throw Error.new(errno.ERR_HTTP_STATUS_NO_200);
		}
		var res = JSON.parse(buf.toString('utf8'));
		if (res.state == 'Success') {
			return res.data;
		} else {
			res.errno = errno.ERR_REQ_DASSET_ERR[0];
			res.state = res.state;
			res.message = res.message || res.error || res.msg;
			throw Error.new(res);
		}
	}
}

class XApi extends SafeRequest {

	getRequestHeaders() {
		return {
			'x-api-key': cfg.x_api_key,
		};
	}

	parseResponseData(buf: IBuffer, r: Result): any {
		if (r.statusCode != 200) {
			throw Error.new(errno.ERR_HTTP_STATUS_NO_200);
		}
		return JSON.parse(buf.toString('utf8')).payload;
	}

}

class Baas extends SafeRequest {
	protected shareKey = 'b4dd53f2fefde37c07ac4824cf7086439633e3a357daacc3aaa16418275a9e51';
	// privateKey: 0x1594e3262ff748d55ac6d220b01f28f9c878760708f1f67d294614e41182deb5
	// publicKey: 0x037be384f878f0d4adeb2e71adc446357e3cc8cdb782a36ddfafc630331c98f717
	private _secretKey = SecretKey.from(buffer.from(
		'1594e3262ff748d55ac6d220b01f28f9c878760708f1f67d294614e41182deb5', 'hex'
	));

	protected async sign(hash32Hex: string) {
		var signature = await this._secretKey.sign(buffer.from(hash32Hex.slice(2), 'hex'))
		return buffer.concat([signature.signature, [signature.recovery]]).toString('base64');
	}

	parseResponseData(buf: IBuffer, r: Result): any {
		if (r.statusCode != 200) {
			throw Error.new(errno.ERR_HTTP_STATUS_NO_200);
		}
		var json = buf.toString('utf8');
		var res = parseJSON(json);
		if (res.errno === 0) {
			return res.data;
		} else {
			throw Error.new(res);
		}
	}

	getRequestHeaders(): Dict {
		return { 'auth-user': 'dphotos' };
	}
}

export const get = req.get;
export const post = req.post;
export const request = req.request;

export const chain = new Chain(cfg.chain);
export const dasset = new Dasset(cfg.dasset);
export const btc = new XApi(cfg.x_api + '/btc/mainnet');
export const baas = new Baas(cfg.baas);

dasset.urlencoded = false;
dasset.timeout = 5e4; // 50s
chain.urlencoded = false;
chain.timeout = 5e4; // 50s
btc.urlencoded = false;
btc.timeout = 5e4;
baas.urlencoded = false;
baas.timeout = 5e4; // 50s

export default chain;