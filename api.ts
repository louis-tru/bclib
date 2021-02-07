/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from './utils';
import * as crypto from 'crypto';
import { ViewController } from 'somes/ctr';
import {RuleResult} from 'somes/router';
import users, {User} from './users';
import errno from './errno';
import message, {Events} from './message';
import cfg from './cfg';

const cryptoTx = require('crypto-tx');
const port = cfg.server.port;
var   enable_auth = cfg.enable_auth as boolean;

message.addEventListener(Events.DTTYD_PORT_FORWARD, (e)=>{
	if (port == e.data.port) {
		enable_auth = false;
	}
});

message.addEventListener(Events.DTTYD_PORT_FORWARD_END, (e)=>{
	if (port == e.data.port) {
		enable_auth = cfg.enable_auth as boolean;
	}
});

export var SHARE_AUTO_KEY = 'b4dd53f2fefde37c07ac4824cf7086439633e3a357daacc3aaa16418275a9e51';

export function setShareAuthKey(key: string) {
	SHARE_AUTO_KEY = key;
}

/**
 * @class APIController
 */
export default class APIController extends ViewController {

	private _user?: User | null;

	private _auth(_: RuleResult): boolean {
		if (!enable_auth) {
			return true;
		}
		var sign = this.headers.sign as string;
		var st = Number(this.headers.st) || 0;
		var key = SHARE_AUTO_KEY;
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

		var user = this.userWithoutErr();
		if (user) {
			if (user.type == 'rsa') {
				sign = crypto.publicDecrypt(user.key, Buffer.from(sign, 'base64')) + '';
			}
			else if (user.type == 'secp256k1') { // secp256k1
				var pkey = Buffer.from(user.key.slice(2), 'hex');
				var buf = Buffer.from(sign, 'base64');
				var signature = Buffer.from(buf.buffer, buf.byteOffset, 64);
				var ok = cryptoTx.verify(Buffer.from(hash), signature, pkey);
				return ok;
			} else {
				console.warn('Authentication mode is not supported', user.type);
				return false;
			}
			return sign == hash;
		}

		return false;
	}

	auth(_: RuleResult) {
		var r = this._auth(_);

		if (utils.debug) {
			console.log(...(r ? []: ['ILLEGAL ACCESS']), this.pathname, this.headers, this.params, this.data);
		}
		return r;
	}

	get userName() {
		return (this.headers['auth-user'] || this.headers['auth-name']) as string || 'default';
	}

	get authorizationUser() {
		var user = this.userWithoutErr() as User;
		utils.assert(user, errno.ERR_AUTH_USER_NON_EXIST);
		return user;
	}

	userWithoutErr() {
		if (this._user === undefined) {
			this._user = users.user(this.userName);
		}
		return this._user;
	}

}
