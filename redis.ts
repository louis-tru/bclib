/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-01-30
*/

import {createClient} from 'redis/dist/index';
import cfg from './cfg';

export const redis = createClient({url: cfg.redis || 'redis://127.0.0.1:6379/0'});

export type Redis = typeof redis;

function getKey(key: string) {
	return `__cache_${key}`;
}

export async function get<T = any>(key: string) {
	var val = await redis.get(getKey(key));
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

export async function set(key: string, val: any, time?: number) {
	time = Number(time) || 0;
	var o = { __time__: time ? time + Date.now(): 0, val };
	await redis.set(getKey(key), JSON.stringify(o));
}

export async function del(key: string) {
	await redis.del(getKey(key));
}

async function test() {

	await redis.set('a', 'A');
	await redis.hSet('b', 'a', 100);

	await redis.sendCommand(['HMSET', 'b', 'a', 'A', 'b', 'B', 'c', 'C', 'd', '']);

	var a = await redis.get('a');
	var b = await redis.hGetAll('b');
	var c = await redis.hGetAll('f');

	console.log(a, b, c);
}

export async function fulushAll() {
	await redis.sendCommand(['FLUSHALL']);
}

export async function initialize(isClean?: boolean) {

	redis.on('error', (err:any) =>console.warn('Redis', err.message));
	redis.on('connect', () =>console.log('Redis connect'));
	redis.on('disconnect', () =>console.log('Redis disconnect'));

	await redis.connect();

	if (isClean) {
		await fulushAll();
	}
	// test();
}
