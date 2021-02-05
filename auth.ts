/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import storage from './storage';
import utils from './utils';
import errno from './errno';
import action from './action';
import * as apps from './apps';
import buffer from 'somes/buffer';

export enum AuthorizationKeyType {
	rsa = 'rsa', secp256k1 = 'secp256k1'
}

export enum AuthorizationMode {
	OUTER, INLINE,
}

export interface AuthorizationToken {
	name: string;
	key: string;
	type: AuthorizationKeyType;
	mode: AuthorizationMode;
	interfaces?: string[]; // 允许访问的接口名列表
}

export const NONE_TOKEN: AuthorizationToken = {
	name: 'NONE',
	key: '',
	type: AuthorizationKeyType.rsa,
	mode: AuthorizationMode.INLINE,
};

class AuthorizationAPI {

	private _other = new Map<string, AuthorizationToken>();

	async initialize() {
		var auhorizationtApps = utils.config.auhorizationtApps;
		if (auhorizationtApps) {
			try {
				for (var app of auhorizationtApps)
					this._other.set(app.appId, AuthorizationAPI.toAuthorizationToken(app));
			} catch(err) {
				console.error(err);
			}
		}
	}

	static toAuthorizationToken(app: apps.ApplicationInfo): AuthorizationToken {
		return {
			name: app.appId,
			key: '0x' + buffer.from(app.appKey, 'base64').toString('hex'),
			type: AuthorizationKeyType.secp256k1,
			mode: AuthorizationMode.INLINE,
		};
	}

	tokens(): string[] {
		var set = new Set<string>();

		for (var name of storage.get('authorizationNames', []) as string[]) {
			set.add(name);
		}
		for (var app of apps.applications()) {
			set.add(app.appId);
		}
		for (var [name] of this._other) {
			set.add(name);
		}

		var tokens = [] as string[];

		for (var user of set) {
			tokens.push(user);
		}

		return tokens;
	}

	token(name: string): AuthorizationToken | null {
		var app = apps.applicationWithoutErr(name);
		if (app) {
			return AuthorizationAPI.toAuthorizationToken(app);
		}
		var token = this._other.get(name);
		if (token) {
			return token;
		}
		return storage.get(`authorization_${name}`) as AuthorizationToken | null;
	}

	/**
	 * 设置外部授权
	 */
	setAuthorizationToken(key: string, type?: AuthorizationKeyType, name?: string): void {
		key = String(key).trim();
		type = type || AuthorizationKeyType.rsa;
		var username = name || 'default'; // utils.hash(utils.random());

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

		var token = this.token(username);
		if (token) {
			// 不允许外部授权更改内部授权
			utils.assert(token.mode == AuthorizationMode.OUTER, errno.ERR_AUTHORIZATION_FAIL);
		}

		var names = storage.get('authorizationNames', []) as string[];
		names.deleteOf(username).push(username);
		storage.set('authorizationNames', names);
		storage.set(`authorization_${username}`, {
			name: username, key, type, mode: AuthorizationMode.OUTER });
	}

	/**
	 * 删除全部外部授权
	 */
	removeAuthorizationTokens() {
		var users = this.tokens();
		for (var user of users) {
			storage.delete(`authorization_${user}`);
		}
		storage.set('authorizationNames', []);
	}

	/**
	 * 删除外部授权
	 */
	removeAuthorizationToken(name: string) {
		var names = (storage.get('authorizationNames', []) as string[]);
		storage.set(`authorizationNames`, names.deleteOf(name));
		storage.delete(`authorization_${name}`);
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

export default new AuthorizationAPI();