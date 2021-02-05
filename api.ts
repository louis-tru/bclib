/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from './utils';
import * as crypto from 'crypto';
import { ViewController } from 'somes/ctr';
import {RuleResult} from 'somes/router';
import auth, {AuthorizationToken, NONE_TOKEN} from './auth';
import message, {Events} from './message';

const cryptoTx = require('crypto-tx');
const port = utils.config.server.port;
var   enableAccessAuth = utils.config.enableAccessAuth as boolean;

message.addEventListener(Events.DTTYD_PORT_FORWARD, (e)=>{
	if (port == e.data.port) {
		enableAccessAuth = false;
	}
});

message.addEventListener(Events.DTTYD_PORT_FORWARD_END, (e)=>{
	if (port == e.data.port) {
		enableAccessAuth = utils.config.enableAccessAuth as boolean;
	}
});

/**
 * @class APIController
 */
export default class APIController extends ViewController {

	private _token?: AuthorizationToken | null;

	auth(_: RuleResult): boolean {

		if (!enableAccessAuth) {
			return true;
		}
		// if (this.socket.remoteAddress == '127.0.0.1' && !this.headers.unsafe) {
		// 	return true;
		// }

		var sign = this.headers.sign as string;
		var st = Number(this.headers.st) || 0;
		var key = 'b4dd53f2fefde37c07ac4824cf7086439633e3a357daacc3aaa16418275a9e51';
		var hash = '';

		if (!st)
			return false;

		// auto current system time
		if (Math.abs(st - Date.now()) > 6e5) // within 10 minutes
			return false;

		if (this.form) {
			this.form.hash.update(st + key);
			hash = this.form.hash.digest('hex');
		} else {
			var md5 = crypto.createHash('md5');
			md5.update(st + key);
			hash = md5.digest('hex');
		}

		var user = this.token;
		if (user !== NONE_TOKEN) {
			if (user.type == 'rsa') {
				sign = crypto.publicDecrypt(user.key, Buffer.from(sign, 'base64')) + '';
			}
			else if (user.type == 'secp256k1') { // secp256k1
				var pkey = Buffer.from(user.key.slice(2), 'hex');
				var buf = Buffer.from(sign, 'base64');
				var signature = Buffer.from(buf.buffer, buf.byteOffset, 64);
				var ok = cryptoTx.verify(Buffer.from(hash), pkey, signature); // verify(message, publicKeyTo, signature)
				return ok;
			} else {
				console.warn('Authentication mode is not supported', user.type);
				return false;
			}
			return sign == hash;
		}

		return false;
	}

	get tokenName() {
		return this.headers['token-name'] as string || 'default';
	}

	get token() {
		if (!this._token) {
			this._token = auth.token(this.tokenName);
		}
		if (!this._token) {
			this._token = NONE_TOKEN;
		}
		return this._token;
	}

}
