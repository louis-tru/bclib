/**
 * @copyright © 2019 Copyright dphone.com
 * @date 2020-07-18
 */

import storage from './storage';
import utils from './utils';
import errno from './errno';
import action from './action';
import * as apps from './apps';
import buffer from 'somes/buffer';
import * as fs  from 'somes/fs2';

export enum AuthorizationKeyType {
	rsa = 'rsa', secp256k1 = 'secp256k1'
}

export enum AuthorizationMode {
	OUTER, INLINE,
}

export interface AuthorizationUser {
	name: string;
	key: string;
	type: AuthorizationKeyType;
	mode: AuthorizationMode;
	interfaces?: string[]; // 允许访问的接口名列表
}

export type User = AuthorizationUser;

class Users {

	private _other = new Map<string, AuthorizationUser>();

	async initialize() {
		// fix old key
		var old_key = storage.get('auth_public_key', '');
		if (old_key) { // 兼容旧的验证方式
			storage.delete('auth_public_key');
			this.setAuthorizationUser_('default', old_key, AuthorizationKeyType.rsa);
		}

		var dphoto_factory = '/mnt/app/software/static/dphoto-factory/app.json';
		if (await fs.exists(dphoto_factory)) {
			try {
				var app = JSON.parse(fs.readFileSync(dphoto_factory) + '');
				this._other.set(app.appId, Users.toAuthorizationUser(app));
			} catch(err) {}
		}

		var auhorizationtApps = utils.config.auhorizationtApps;
		if (auhorizationtApps) {
			try {
				for (var app of auhorizationtApps)
					this._other.set(app.appId, Users.toAuthorizationUser(app));
			} catch(err) {
				console.error(err);
			}
		}
	}

	static toAuthorizationUser(app: apps.ApplicationInfo): AuthorizationUser {
		return {
			name: app.appId,
			key: '0x' + buffer.from(app.appKey, 'base64').toString('hex'),
			type: AuthorizationKeyType.secp256k1,
			mode: AuthorizationMode.INLINE,
		};
	}

	users(): string[] {
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

		var users = [] as string[];

		for (var user of set) {
			users.push(user);
		}

		return users;
	}

	user(name: string): AuthorizationUser | null {
		var app = apps.applicationWithoutErr(name);
		if (app) {
			return Users.toAuthorizationUser(app);
		}
		var user = this._other.get(name);
		if (user) {
			return user;
		}
		return storage.get(`authorization_${name}`) as AuthorizationUser | null;
	}

	private setAuthorizationUser_(name: string, key: string, type?: AuthorizationKeyType): void {
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

		var user = this.user(username);
		if (user) {
			// 不允许外部授权更改内部授权
			utils.assert(user.mode == AuthorizationMode.OUTER, errno.ERR_AUTHORIZATION_FAIL);
		}

		var names = storage.get('authorizationNames', []) as string[];
		names.deleteOf(username).push(username);
		storage.set('authorizationNames', names);
		storage.set(`authorization_${username}`, { name: username, key, type, mode: AuthorizationMode.OUTER });
	}

	/**
	 * 设置外部授权
	 */
	setAuthorizationUser(request_auth_key: string, name: string, key: string, type?: AuthorizationKeyType) {
		this.checkRequestAuthorizationKey(request_auth_key);
		this.setAuthorizationUser_(name, key, type);
	}

	/**
	 * 删除全部外部授权
	 */
	removeAuthorizationUsers() {
		var users = this.users();
		for (var user of users) {
			storage.delete(`authorization_${user}`);
		}
		storage.set('authorizationNames', []);
	}

	/**
	 * 删除外部授权
	 */
	removeAuthorizationUser(name: string) {
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

export default new Users();