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

export enum AuthorizationKeyType {
	rsa = 'rsa', secp256k1 = 'secp256k1'
}

export enum AuthorizationMode { // mode or role
	INLINE, OUTER, OTHER,
}

export interface AuthorizationUser {
	name: string;
	key: string;
	keyType: AuthorizationKeyType;
	mode: AuthorizationMode; // mode or role
	interfaces?: string; // 允许访问的接口名列表
}

export type User = AuthorizationUser;

export interface Cache {
	get(name: string): Promise<User | null>;
	set(name: string, user: User | null): void;
	clear(): void;
};

class DefaultCacheIMPL implements Cache {
	private _value: Map<string, User> = new Map();
	get(name: string): Promise<User | null> {
		return Promise.resolve(this._value.get(name) || null);
	}
	set(name: string, user: User | null): void {
		if (user) {
			this._value.set(name, user);
		} else {
			this._value.delete(name);
		}
	}
	clear(): void {
		this._value.clear();
	}
}

export class AuthorizationManager {

	private _cache: Cache = new DefaultCacheIMPL();

	setCache(cache: Cache) {
		this._cache = cache;
	}

	async initialize() {
		// fix old key
		// var old_key = storage.get('auth_public_key', '');
		// if (old_key) { // 兼容旧的验证方式
		// 	storage.delete('auth_public_key');
		// 	this.setAuthorizationUserNoCheck('default', old_key, AuthorizationKeyType.rsa);
		// }
	}

	static toAuthorizationUser(app: apps.ApplicationInfo): AuthorizationUser {
		return {
			name: app.appId,
			key: app.appKey,
			keyType: app.keyType as AuthorizationKeyType || AuthorizationKeyType.secp256k1,
			mode: AuthorizationMode.INLINE,
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
		var [_user] = await db.select('auto_user', { name }) as AuthorizationUser[];
		if (_user) {
			this._cache.set(name, _user);
			return _user;
		}
		return null;
	}

	async setAuthorizationUserNoCheck(name: string, key: string, type?: AuthorizationKeyType, mode?: number) {
		key = String(key).trim();
		type = type || AuthorizationKeyType.secp256k1;
		name = name || 'default';
		mode = mode || AuthorizationMode.OUTER;

		if (type == AuthorizationKeyType.rsa) {
			if (!/BEGIN PUBLIC KEY/.test(key)) {
				key = '-----BEGIN PUBLIC KEY-----\n' + key;
			}
			if (!/END PUBLIC KEY/.test(key)) {
				key += '\n-----END PUBLIC KEY-----';
			}
		} else {
			if (key.substr(0, 2) != '0x') {
				key = '0x' + key;
			}
		}
		var user: AuthorizationUser = { name, key, keyType: type, mode };

		utils.assert(mode != AuthorizationMode.INLINE, errno.ERR_BAD_AUTH_USER_MODE);

		if (await this.user(name)) {
			// 不允许外部授权更改内部授权
			utils.assert(user.mode != AuthorizationMode.INLINE, errno.ERR_AUTHORIZATION_FAIL);
			await db.update('auto_user', user, {name});
		} else {
			await db.insert('auto_user', { ...user, time: Date.now() });
		}
		this._cache.set(name, user);
	}

	/**
	 * 设置外部授权
	 */
	async setAuthorizationUser(request_auth_key: string, name: string, key: string, type?: AuthorizationKeyType, mode?: number) {
		this.checkRequestAuthorizationKey(request_auth_key);
		await this.setAuthorizationUserNoCheck(name, key, type, mode);
	}

	/**
	 * 通过mode删除全部外部授权
	 */
	 async removeAuthorizationUsers(mode: number) {
		await db.delete('auto_user', {mode});
		this._cache.clear();
	}

	/**
	 * 删除外部授权
	 */
	async removeAuthorizationUser(name: string) {
		await db.delete('auto_user', {name});
		this._cache.set(name, null);
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