/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from 'somes';

const ETH_RATIO = 18;

export const prod = utils.config.env == 'prod';

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

export function toEthReduced(ethStr: string): number {
	return moveDecimalForLeft(ethStr, ETH_RATIO, 10);
}

export function toRawEth(ethNum: number): string {
	return moveDecimalForRight(ethNum, ETH_RATIO);
}

export default utils;