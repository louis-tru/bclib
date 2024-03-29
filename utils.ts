/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from 'somes';
import {Options,Params} from 'somes/request';
import storage from './storage';
import {BcRequest} from './request';

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
	var key = '_c_' + (id || utils.random(0, 1e6));

	async function noCache(...args: A): Promise<R> {
		try {
			var value: R;
			if (timeout) {
				value = await utils.timeout(fetch(...args), timeout);
			} else {
				value = await fetch(...args);
			}
			await storage.set(key, { value, time: Date.now() + cacheTime });
			return value;
		} catch(error) {
			var cache = await storage.get(key);
			if (cache) { // use cache
				if (typeof cache.value == 'object') {
					return { ...cache.value, error };
				} else {
					return cache.value;//
				}
			}
			throw error;
		}
	}

	async function call(...args: A): Promise<R> {
		var value = await storage.get(key) || { value: null, time: 0 };
		if (value.time < Date.now()) {
			return await noCache(...args);
		}
		return value.value;
	}

	async function cache(...args: A): Promise<R> {
		var value = await storage.get(key);
		if (value) {
			return Promise.resolve(value.value as R);
		}
		return await call(...args);
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
	api: BcRequest,
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
		await storage.set(key, data);
	} catch(err) {
		data = await storage.get(key);
		if (!data) {
			throw err;
		}
	}
	return data;
}
