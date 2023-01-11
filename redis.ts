/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-01-30
*/

import {createClient} from 'redis/dist/index';
import cfg from './cfg';

export const client = createClient({url: cfg.redis || 'redis://127.0.0.1:6379/0'});

export type Redis = typeof client;

function getKey(key: string) {
	return `${cfg.name}_${key}`;
}

export async function get<T = any>(key: string) {
	var val = await client.get(getKey(key));
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
	await client.set(getKey(key), JSON.stringify(o));
}

export async function del(key: string) {
	await client.del(getKey(key));
}

export async function test() {

	await client.set('a', 'A');

	await client.sendCommand(['HMSET', 'b', 'a', 'A', 'b', 'B', 'c', 'C', 'd', '']);

	let a = await client.get('a');
	let b = await client.hGetAll('b');
	let c = await client.hGetAll('c');

	console.log(a, b, c);

	await client.hSet('b', 'a', 100);

	let b_a = await client.hGet('b', 'a');
	let b2 = await client.hGetAll('b');

	console.log(b_a, b2);

}

export async function fulushAll() {
	await client.sendCommand(['FLUSHALL']);
}

export async function initialize(isClean?: boolean) {

	client.on('error', (err:any) =>console.warn('Redis', err.message));
	client.on('connect', () =>console.log('Redis connect'));
	client.on('disconnect', () =>console.log('Redis disconnect'));

	await client.connect();

	if (isClean) {
		await fulushAll();
	}
	// test();
}
