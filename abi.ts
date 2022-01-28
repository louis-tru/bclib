/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2018-07-21
 */

import * as fs from 'somes/fs2';
import * as path from 'path';
import paths from './paths';
import utils from './utils';
import {AbiItem} from 'web3-utils';
import errno from './errno';

const hashs: Dict<number> = {};

export enum ABIType {
	STAR = 1, // Deprecated
	BANK = 2,
	KUN = 3, // Deprecated
	BIGBANG = 5, // Deprecated
	ERC20 = 6,
	ERC721 = 7,
	MINING = 8, // Deprecated
	MINER = 11, // Deprecated
	KUN_CTR = 33, // Deprecated
	PROOF = 40, 
	CASPER = 41,
};

export interface AbiInterface {
	address: string,
	abi: AbiItem[],
}

const getLocalAbiCache: Dict<AbiInterface> = {};

var is_SAVE_ABI_TO_LOCAL = true;

export function setSaveAbiToLocal(is_save: boolean) {
	is_SAVE_ABI_TO_LOCAL = !!is_save;
}

export async function getLocalAbi(pathname: string) {
	// var data = await dasset.post('device/getDeviceBySN', { device_sn: device.serialNumber });

	if (getLocalAbiCache[pathname])
		return getLocalAbiCache[pathname];

	if (await fs.exists(pathname)) {
		try {
			var b = await fs.readFile(pathname);
			var abi = JSON.parse(b.toString('utf-8')) as AbiInterface;

			if (Array.isArray(abi)) {
				abi = { abi: abi as AbiItem[] } as AbiInterface;
			}
			if (abi.abi.length) {
				if (!abi.address) {
					var basename = path.basename(pathname);
					var extname = path.extname(pathname);
					abi.address = basename.substring(0, basename.length - extname.length);
				}
				getLocalAbiCache[pathname] = abi;
				return abi;
			}
		} catch(err) { // 可能文件损坏
			console.warn(err);
		}
	}
}

export type FetchAbiFun = (address: string, chain: number, type?: ABIType)=>Promise<AbiInterface|undefined>;

export const FetchAbiFunList: FetchAbiFun[] = [];

async function getAbi({address,chain,type}: {address?: string, chain?: number, type?: ABIType}) {
	var name = address ? `${address}_${chain}`: `${ABIType[type||0]}`;
	var path = `${paths.var}/abis/${name}.json`;
	var abi: AbiInterface|undefined;

	for (var fetch of FetchAbiFunList) {
		try {
			if (abi = await fetch(address || '', chain || 0, type))
				break;
		} catch(err) {
			console.warn(err);
		}
	}

	if (abi) { // save cache file
		if (is_SAVE_ABI_TO_LOCAL) {
			var hash = abi.hashCode();
			if (hashs[name] != hash) {
				hashs[name] = hash;
				hashs[abi.address] = hash;
				var abi_json = JSON.stringify(abi, null, 2);
				fs.writeFileSync(path, abi_json);
				if (!address) // type and star
					fs.writeFileSync(`${paths.var}/abis/${abi.address}.json`, abi_json);
			}
		}
	} else {
		abi = await getLocalAbi(path); // 读取缓存文件
	}

	utils.assert(abi, errno.ERR_STAR_ADDRESS_NOT_FOUND, { address, type });
	
	return abi as AbiInterface;
}

export function getAbiByType(type: ABIType) {
	return getAbi({type});
}

export function getAbiByAddress(address: string, chain: number) {
	return getAbi({address, chain});
}

export function getCasperAbi() {
	return getAbi({type:ABIType.CASPER});
}

export async function getAddressByType(type: ABIType) {
	var abi = await getAbi({type});
	return abi.address;
}