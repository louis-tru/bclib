/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2018-07-21
 */

import * as fs from 'somes/fs2';
import * as path from 'path';
import paths from './paths';
import {dasset} from './request';
import utils, * as utils2 from './utils';
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

export async function getLocalAbi(pathname: string) {
	// var data = await dasset.post('device/getDeviceBySN', { device_sn: device.serialNumber });

	if (fs.existsSync(pathname)) {
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
				return abi;
			}
		} catch(err) { // 可能文件损坏
			console.error(err);
		}
	}
}

type FetchAbiFun = (address: string)=>Promise<AbiInterface|undefined>;

export const fetchAbiFunList: FetchAbiFun[] = [
	async function(address: string) {
		var opts = {cacheTime: utils2.prod ? 24*3600*1000/*1d*/ : 2e5/*200s*/};
		var {data} = await dasset.post('contract/getAbiByAddress', { address }, opts);
		utils.assert(data, errno.ERR_GET_ABI_NOT_FOUND);
		return { ...data, abi: JSON.parse(data.abi) } as AbiInterface;
	}
];

export async function getAbiFromExternal({ address, type, star }: { address?: string, type?: ABIType, star?: string }) {
	var opts = {cacheTime: utils2.prod ? 24*3600*1000/*1d*/ : 2e5/*200s*/};
	var data: AbiInterface | undefined;
	if (address) {
		for (var fetch of fetchAbiFunList) {
			try {
				if (data = await fetch(address)) {
					break;
				}
			} catch(err) {
				console.error(err);
			}
		}
	} else if (type) {
		var types: Dict<number> = {
			[ABIType.PROOF]: 1, // 1-proof
			[ABIType.ERC20]: 2, // 2-erc20
			[ABIType.ERC721]: 3, // 3-erc721
			[ABIType.BANK]: 4, // 4-bank
			[ABIType.CASPER]: 5, // 4-casper
		};
		var tpye_ = types[type] || 1; // default 1-proof
		var {data: data_} = await dasset.post('contract/getAbiByType', { type: tpye_, id: star, star }, opts);
		utils.assert(data_, errno.ERR_GET_ABI_NOT_FOUND);
		data = { ...data_, abi: JSON.parse(data_.abi) };
	}

	utils.assert(data && data.address == address, errno.ERR_GET_ABI_NOT_FOUND);
	return data as AbiInterface;
}

async function getAbi(address?: string, type?: ABIType, star?: string) {
	await fs.mkdirp(`${paths.var}/abis`);
	var name = address || ('abi_type_' + String(type) + '_' + (star||''));
	var path = `${paths.var}/abis/${name}.json`;
	var abi: AbiInterface|undefined;

	try {
		abi = await getAbiFromExternal({address, type, star});
	} catch(err) {
		console.error(err);
	}

	if (abi) { // save cache file
		var hash = abi.hashCode();
		if (hashs[name] != hash) {
			hashs[name] = hash;
			hashs[abi.address] = hash;
			var abi_json = JSON.stringify(abi, null, 2);
			fs.writeFileSync(path, abi_json);
			if (!address) // type and star
				fs.writeFileSync(`${paths.var}/abis/${abi.address}.json`, abi_json);
		}
	} else {
		abi = await getLocalAbi(path); // 读取缓存文件
	}

	utils.assert(abi, errno.ERR_STAR_ADDRESS_NOT_FOUND);
	
	return abi as AbiInterface;
}

export function getAbiByType(type: ABIType, star?: string) {
	return getAbi('', type, star);
}

export function getAbiByAddress(address: string) {
	return getAbi(address);
}

export function getCasperAbi() {
	return getAbiByType(ABIType.CASPER);
}

export async function getAddressByType(type: ABIType, star?: string) {
	return (await getAbiByType(type, star)).address;
}