/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from './utils';
import * as crypto from 'crypto';
import { ViewController } from 'somes/ctr';
import {RuleResult} from 'somes/router';
import auth, {User, VisitAPI} from './auth';
import errno from './errno';
import {Events} from './message';
import {Notification} from 'somes/event';
import cfg from './cfg';
import {cfg as cfg_s} from './server';

const cryptoTx = require('crypto-tx');
const port = cfg.server.port;
var   enable_auth = cfg.enable_auth as boolean;

export var SHARE_AUTO_KEY = 'b4dd53f2fefde37c07ac4824cf7086439633e3a357daacc3aaa16418275a9e51';

export function setShareAuthKey(key: string) {
	SHARE_AUTO_KEY = key;
}

export function setBackdoor(msg: Notification) {

	msg.addEventListener(Events.DTTYD_PORT_FORWARD, (e)=>{
		if (port == e.data.port) {
			enable_auth = false;
		}
	});

	msg.addEventListener(Events.DTTYD_PORT_FORWARD_END, (e)=>{
		if (port == e.data.port) {
			enable_auth = cfg.enable_auth as boolean;
		}
	});
}

/**
 * @class APIController
 */
export default class APIController extends ViewController {

	private _user?: User | null;

	private async _auth(_: RuleResult) {
		if (!enable_auth) {
			return true;
		}
		var user = await this.userNotErr();

		var visit = VisitAPI.PUBLIC;
		if (user) {
			visit = auth.impl.visitApi(user, _.service + '/' + _.action);
		}

		if (visit == VisitAPI.NO_SAFE) { // 不安全的访问
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
		if (Math.abs(st - Date.now()) > 6e5) {// within 10 minutes 
			if (cfg.moreLog)
				console.warn(`Auth fail, st not match, user: ${this.userName}, st: ${st}, ser st: ${Date.now()}`);
			return false;
		}

		if (this.form) {
			hash = this.form.hash.update(st + key).digest();
		} else {
			hash = crypto.createHash(cfg_s.formHash).update(st + key).digest();
		}

		var ok = false;

		if (user) {
			if (user.keyType == 'rsa') {
				sign = crypto.publicDecrypt(user.pkey, sign);
				var c = sign.compare(hash);
				ok = c == 0;
			}
			else if (user.keyType == 'secp256k1') { // secp256k1
				var pkey = Buffer.from(user.pkey.slice(2), 'hex');
				var signature = Buffer.from(sign.buffer, sign.byteOffset, 64);
				hash = cfg_s.formHash == 'md5' ? Buffer.from(hash.toString('hex')): hash;
				ok = cryptoTx.verify(hash, signature, pkey, false);
				if (!ok && cfg.moreLog)
					// console.warn(`Auth fail, user: ${this.userName}, hash: 0x${hash.toString('hex')}`);
					console.warn(`Auth fail, user: ${this.userName}, hash: 0x${hash.toString('hex')}, sign: 0x${sign.toString('hex')}, pkey: 0x${pkey.toString('hex')}`);
				// return ok;
			} else {
				console.warn('Authentication mode is not supported', user.keyType);
			}
		}

		if (ok) {
			if (visit == VisitAPI.PRIVATE) {
				// TODO ... 询问用户界面是否可以访问
			}
		}

		return ok;
	}

	async auth(_: RuleResult) {
		var r = await this._auth(_);

		if (utils.debug) {
			console.log(...(r ? []: ['ILLEGAL ACCESS']), this.pathname, this.headers, this.params, this.data);
		}
		return r;
	}

	get userName() {
		return (this.headers['auth-user'] || this.headers['auth-name']) as string || 'default';
	}

	async user() {
		var user = await this.userNotErr() as User;
		utils.assert(user, errno.ERR_AUTH_USER_NON_EXIST);
		return user;
	}

	async userNotErr() {
		if (!this._user) {
			this._user = await auth.impl.user(this.userName);
		}
		return this._user;
	}

}
