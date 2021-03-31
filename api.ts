/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from './utils';
import * as crypto from 'crypto';
import { ViewController } from 'somes/ctr';
import {RuleResult} from 'somes/router';
import auth, {User} from './auth';
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
		var signRaw = this.headers.sign as string;
		if (!signRaw)
			return false;
		var sign = signRaw.substr(0, 2) == '0x' ? 
			Buffer.from(signRaw.slice(2), 'hex'): Buffer.from(signRaw, 'base64');
		var st = Number(this.headers.st) || 0;
		var key = SHARE_AUTO_KEY;
		var hash: Buffer;

		if (!st)
			return false;

		// auto current system time
		if (Math.abs(st - Date.now()) > 6e5) // within 10 minutes
			return false;

		if (this.form) {
			hash = this.form.hash.update(st + key).digest();
		} else {
			hash = crypto.createHash('sha256').update(st + key).digest();
		}

		var user = this.userWithoutErr();
		if (user) {
			if (user.keyType == 'rsa') {
				sign = crypto.publicDecrypt(user.key, sign);
				var c = sign.compare(hash);
				return c == 0;
			}
			else if (user.keyType == 'secp256k1') { // secp256k1
				var pkey = Buffer.from(user.key.slice(2), 'hex');
				var signature = Buffer.from(sign.buffer, sign.byteOffset, 64);
				var ok = cryptoTx.verify(hash, signature, pkey, false);
				return ok;
			} else {
				console.warn('Authentication mode is not supported', user.keyType);
			}
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
			this._user = auth.user(this.userName);
		}
		return this._user;
	}

}
