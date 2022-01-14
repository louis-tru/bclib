/**
 * @copyright © 2019 Copyright dphone.com
 * @date 2020-07-18
 */

import utils from './utils';
import errno from './errno';
import action from './action';
import * as apps from './apps';
import buffer from 'somes/buffer';
import db from './db';
import {StaticObject} from './obj';
import {Notification} from 'somes/event';
import {Events} from './message';

export enum AuthorizationKeyType {
	rsa = 'rsa', secp256k1 = 'secp256k1'
}

export enum AuthorizationMode { // mode or role
	INLINE, OUTER, OTHER,
}

export enum VisitAPI {
	PUBLIC  = 0,  // 需要签名才能访问
	PRIVATE = 1,  // 需要签名才能访问
	NO_SAFE = 2,  // 完全公开无需签名也能访问
}

export interface AuthorizationUser {
	id: number;
	name: string;
	pkey: string;
	key2?: string,
	keyType: AuthorizationKeyType;
	mode: AuthorizationMode; // mode or role
	interfaces?: Dict<VisitAPI>; // 允许访问的接口名列表
	time: number;
	ref?: string; // 引用的一个值可以是别这个用户的身份id分身好可以是别的属性
}

export type User = AuthorizationUser;

export interface Cache {
	get(name: string): Promise<User | null>;
	set(name: string, user: User | null): void;
};

class DefaultCacheIMPL implements Cache {
	private _value: Map<string, {timeout: number; user: User}> = new Map();

	async get(name: string): Promise<User | null> {
		var user = this._value.get(name);
		if (user) {
			if (user.timeout > Date.now()) {
				return user.user;
			}
			this._value.delete(name);
		}
		return null;
	}
	set(name: string, user: User | null): void {
		if (user) {
			this._value.set(name, {timeout: Date.now() + 3e4, user});
		} else {
			this._value.delete(name);
		}
	}
}

export class AuthorizationManager {

	private _cache: Cache = new DefaultCacheIMPL();
	private _msg?: Notification;

	setCache(cache: Cache) {
		this._cache = cache;
	}

	private _SetCache(name: string, user: User | null) {
		this._cache.set(name, user);
		if (this._msg) {
			this._msg.trigger(Events.AuthorizationUserUpdate, {name, user});
		}
	}

	async initialize(msg?: Notification) {
		// fix old key
		// var old_key = storage.get('auth_public_key', '');
		// if (old_key) { // 兼容旧的验证方式
		// 	storage.delete('auth_public_key');
		// 	this.setAuthorizationUserNoCheck('default', old_key, AuthorizationKeyType.rsa);
		// }
		this._cache = new DefaultCacheIMPL();
		if (msg) {
			msg.addEventListener(Events.AuthorizationUserUpdate, ({data})=>{
				if (data.name) {
					this._cache.set(data.name, data.user);
				}
			});
		}
	}

	static toAuthorizationUser(app: apps.ApplicationInfo): AuthorizationUser {
		return {
			id: -1,
			name: app.appId,
			pkey: app.appKey,
			keyType: app.keyType as AuthorizationKeyType || AuthorizationKeyType.secp256k1,
			mode: AuthorizationMode.INLINE,
			time: 0,
		};
	}

	async user(name: string): Promise<AuthorizationUser | null> {
		var app = apps.applicationWithoutErr(name);
		if (app) {
			return AuthorizationManager.toAuthorizationUser(app);
		}
		var user = await this._cache.get(name);
		if (user) {
			return user;
		}
		var _user = await db.selectOne<AuthorizationUser>('auth_user', { name });
		if (_user) {
			if (_user.interfaces) {
				try {
					_user.interfaces = JSON.parse(_user.interfaces as any);
				} catch(err) {}
			}
			this._cache.set(name, _user);
			return _user;
		}
		return null;
	}

	visitApi(user: AuthorizationUser, api: string) {
		if (user.interfaces) {
			return user.interfaces[api] || VisitAPI.PUBLIC;
		}
		return VisitAPI.PUBLIC;
	}

	async setAuthorizationUserNoCheck(name: string, user_: Partial<User>) {
		var name = name || 'default';
		var row: Dict = { ref: user_.ref, key2: user_.key2 };

		if (user_.pkey) {
			var pkey = user_.pkey.trim();
			var keyType = user_.keyType || AuthorizationKeyType.secp256k1;
			if (keyType == AuthorizationKeyType.rsa) {
				if (!/BEGIN PUBLIC KEY/.test(pkey)) {
					pkey = '-----BEGIN PUBLIC KEY-----\n' + pkey;
				}
				if (!/END PUBLIC KEY/.test(pkey)) {
					pkey += '\n-----END PUBLIC KEY-----';
				}
			} else {
				if (pkey.substring(0, 2) != '0x') {
					pkey = '0x' + pkey;
				}
			}
			Object.assign(row, { pkey, keyType });
		}

		if ('mode' in user_) row.mode = Number(user_.mode) || AuthorizationMode.INLINE;
		if ('ref' in user_) row.ref = user_.ref;
		if ('key2' in user_) row.key2 = user_.key2;

		if (Object.keys(user_).length === 0)
			return; // 

		row.name = name;

		this._cache.set(name, null); // clear cache
		var user = await this.user(name) as User;
		if (user) {
			// 不允许外部授权更改内部授权
			utils.assert(row.mode !== AuthorizationMode.INLINE, errno.ERR_AUTHORIZATION_FAIL);
			await db.update('auth_user', row, {name});
			Object.assign(user, row);
		} else {
			user = {
				pkey: '', 
				mode: AuthorizationMode.OUTER, ...row, time: Date.now(),
			} as User;
			user.id = await db.insert('auth_user', user);
		}
		this._SetCache(name, user);
	}

	/**
	 * 设置外部授权
	 */
	async setAuthorizationUser(request_auth_key: string, name: string, pkey: string, keyType?: AuthorizationKeyType, mode?: number) {
		this.checkRequestAuthorizationKey(request_auth_key);
		await this.setAuthorizationUserNoCheck(name, {pkey, keyType, mode});
	}

	/**
	 * 删除外部授权
	 */
	async removeAuthorizationUser(name: string) {
		await db.delete('auth_user', {name});
		this._SetCache(name, null);
	}

	// ---- Authorization auth ----

	private _request_auth_key = { value: '', st: 0, };

	/**
	 * @func requestAuthorization() 请求授权访问
	 */
	async requestAuthorization(origin: string, applicationName: string, applicationText?: string) {
		await action.request('RequestAuthorization', { origin, applicationName, applicationText });
	}

	agreeRequestAuthorization(isAgree: boolean) {
		action.agree('RequestAuthorization', isAgree);
	}

	getRequestAuthorizationKey(): string {
		var bf = Buffer.alloc(32);
		bf.writeInt32LE(utils.hash(utils.random()).hashCode(), 0);
		this._request_auth_key.value = buffer.from(bf).toString('base58').toUpperCase().slice(0, 4);
		this._request_auth_key.st = Date.now();
		return this._request_auth_key.value;
	}

	checkRequestAuthorizationKey(request_auth_key: string) {
		request_auth_key = request_auth_key.toUpperCase();
		console.log('bind user auth', request_auth_key, this._request_auth_key.value);
		utils.assert(request_auth_key == this._request_auth_key.value, errno.ERR_BIND_AUTH_FAIL);
		utils.assert(Date.now() - this._request_auth_key.st < 1.8e5, errno.ERR_BIND_AUTH_TIMEOUT);
		this._request_auth_key = { value: '', st: 0 };
	}

}

export default new StaticObject(AuthorizationManager);