/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-01-30
*/

import {createClient, RedisClientType} from 'redis/dist/index';
export {RedisClientType} from 'redis/dist/index';
import cfg from './cfg';
import {env} from './env';

function getKey(key: string) {
	return `${cfg.name}_${key}`;
}

export class Redis {

	readonly client: RedisClientType;
	private _connected = false;

	constructor(url: string, pwd?: string) {
		this.client = createClient({url, password: pwd||undefined});
	}

	async get<T = any>(key: string) {
		var val = await this.client.get(getKey(key));
		if (val && val != 'null') {
			try {
				var o = JSON.parse(val) as { __time__: number, val: T };
				if (!o.__time__ || o.__time__ > Date.now()) {
					return o.val;
				}
			} catch(err: any) {
				console.warn(err);
			}
		}
		return null;
	}
	
	async set(key: string, val: any, time?: number) {
		time = Number(time) || 0;
		var o = { __time__: time ? time + Date.now(): 0, val };
		await this.client.set(getKey(key), JSON.stringify(o));
	}
	
	async del(key: string) {
		await this.client.del(getKey(key));
	}
	
	async fulushAll() {
		await this.client.sendCommand(['FLUSHALL']);
	}

	async initialize(isClean?: boolean) {
		if (this._connected) return;
	
		this.client.on('error', (err:any) =>console.warn('Redis', err.message));
		this.client.on('connect', () =>console.log('Redis connect'));
		this.client.on('disconnect', () =>console.log('Redis disconnect'));
	
		await this.client.connect();
	
		if (isClean || env != 'prod')
			await this.fulushAll();

		this._connected = true;
	}
}

export async function test() {

	let client = _default.client;
	
	await _default.set('a', 'A');

	await _default.client.sendCommand(['HMSET', 'b', 'a', 'A', 'b', 'B', 'c', 'C', 'd', '']);

	let a = await client.get('a');
	let b = await client.hGetAll('b');
	let c = await client.hGetAll('c');

	console.log(a, b, c);

	await client.hSet('b', 'a', 100);

	let b_a = await client.hGet('b', 'a');
	let b2 = await client.hGetAll('b');

	console.log(b_a, b2);
}

const _default = new Redis(cfg.redis || 'redis://127.0.0.1:6379/0', cfg.redis_pwd);

export default _default;