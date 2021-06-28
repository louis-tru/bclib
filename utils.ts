/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from 'somes';
import {Options,Params,Signer} from 'somes/request';
import storage from './storage';
import buffer from 'somes/buffer';
import {SafeRequest, post} from './request';
import cfg from './cfg';
import keys from './keys+';
import db from './db';

const crypto_tx = require('crypto-tx');

export const prod = cfg.env == 'prod';
export const ETH_RATIO = 18;

/**
 * 向左边移动小数点
 */
export function moveDecimalForLeft(intStr: string, count: number, fixed: number): number {

	var i = intStr.length - count;
	var r;
	if (i <= 0) {
		r = '0.' + new Array(1 - i).join('0') + intStr;
	} else {
		r = intStr.substr(0, i) + '.' + intStr.substr(i);
	}
	return Number(Number(r).toFixed(fixed));
}

/**
 * 向右边移动小数点
 */
export function moveDecimalForRight(num: string | number, count: number, ellipsis: boolean = false): string {
	num = Number(num);
	if (num === 0) return '0';
	var ls = String(Number(num)).split('.');
	var a = ls[0];
	var b = ls[1] || '';
	if (b.length < count) {
		return a + b + new Array(count - b.length + 1).join('0');
	} else if (b.length == count) {
		return a + b.substr(0, count);
	} else {
		return a + b.substr(0, count) + (ellipsis ? '' : '.' + b.substr(count));
	}
}

export function toEth(ethStr: string): number {
	return moveDecimalForLeft(ethStr, ETH_RATIO, 10);
}

export function toWei(ethNum: number): string {
	return moveDecimalForRight(ethNum, ETH_RATIO);
}

const create_cache_funcs: Dict = {};
export const trustCloud: boolean = 'trustCloud' in utils.config ? !!utils.config.trustCloud : false;

export enum CacheMode {
	AUTO = 0,
	NO_CACHE = 1,
	CACHE = -1,
}

export interface CacheFunction<A extends any[], R> {
	(no_cache?: CacheMode, ...args: A): Promise<R>;
	noCache(...args: A): Promise<R>;
	call(...args: A): Promise<R>;
	cache(...args: A): Promise<R>;
}

export function createCache<A extends any[], R>(
	fetch: (...args: A)=>Promise<R>, { cacheTime = 1e4, timeout = 0, id = '' }): CacheFunction<A, R> {

	if (id && create_cache_funcs[id]) {
		return create_cache_funcs[id];
	}
	var key = '__cache_' + utils.id;

	async function noCache(...args: A): Promise<R> {
		try {
			var value: R;
			if (timeout) {
				value = await utils.timeout(fetch(...args), timeout);
			} else {
				value = await fetch(...args);
			}
			storage.set(key, { value, time: Date.now() + cacheTime });
			return value;
		} catch(error) {
			var cache = storage.get(key);
			if (cache) { // use cache
				return { ...cache.value, error };
			}
			throw error;
		}
	}

	async function call(...args: A): Promise<R> {
		var value = storage.get(key) || { value: null, time: 0 };
		if (value.time < Date.now()) {
			return await noCache(...args);
		}
		return value.value;
	}

	async function cache(...args: A): Promise<R> {
		var value = storage.get(key);
		if (value) {
			return Promise.resolve(value.value as R);
		}
		return call(...args);
	}

	function func(no_cache = CacheMode.AUTO, ...args: A): Promise<R> {
		if (no_cache) {
			return no_cache > 0 ? noCache(...args): cache(...args);
		} else {
			return call(...args);
		}
	}

	func.call = call;
	func.noCache = noCache;
	func.cache = cache;

	if (id) {
		create_cache_funcs[id] = func;
	}

	return func as CacheFunction<A, R>;
}

export async function callApi(
	api: SafeRequest,
	name: string,
	method: 'post' | 'get' = 'post',
	params?: Params,
	options?: Options
): Promise<any> {
	var data = null;
	var key = '_callApi_' + name + method + Object.hashCode(params);
	try {
		if (method == 'get') {
			var {data} = await api.get(name, params, options);
		} else {
			var {data} = await api.post(name, params, options);
		}
		storage.set(key, data);
	} catch(err) {
		// console.error(err);
		data = storage.get(key);
		if (!data) {
			throw err;
		}
	}
	return data;
}

class SignerIMPL implements Signer {
	async sign(path: string, data: string) {
		var st = String(Date.now());
		var key = 'a4dd53f2fefde37c07ac4824cf7086439633e1a357daacc3aaa16418275a9e48';
		var hash = crypto_tx.keccak(path + data + st + key).data;
		var signature = await keys.impl.sign(buffer.from(hash), keys.impl.defauleAddress);
		var sign = buffer.concat([signature.signature, [signature.recovery]]).toString('base64');
		return { st, sign };
	}
}

var signer = new SignerIMPL();

async function callbackURL_impl(data: any, url: string, id: number) {
	var sleep = 10;
	var retry = 24;
	while (--retry) {
		try {
			var r = await post(url, { params: data, urlencoded: false, signer });
			if (r.statusCode == 200) {
				await db.deleteById('callback_url', id);
				return;
			}
		} catch(err) {}
		await utils.sleep(sleep * 1e3);
		sleep = Math.min(3600, sleep * 1.5);
	}
	await db.update('callback_url', { status: 3 }, { id });
}

export async function callbackURI(data: any, url: string) {
	var id = await db.insert('callback_url', { url, data: JSON.stringify(data) }) as number;
	await callbackURL_impl(data, url, id);
}

export async function initialize() {
	var items = await db.select('callback_url', { status: 0 });
	for (var item of items) {
		try {
			callbackURL_impl(JSON.parse(item.data), item.url, item.id);
		} catch(err) {
			await db.update('callback_url', { status: 3 }, { id: item.id });
		}
	}
}

export default utils;