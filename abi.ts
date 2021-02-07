/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2018-07-21
 */

import * as fs from 'somes/fs2';
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

export async function getLocalAbi(path: string) {
	// var data = await dasset.post('device/getDeviceBySN', { device_sn: device.serialNumber });

	if (fs.existsSync(path)) {
		try {
			var b = await fs.readFile(path);
			var abi = JSON.parse(b.toString('utf-8')) as AbiInterface;
			if (abi.abi.length) {
				return abi;
			}
		} catch(err) { // 可能文件损坏
			console.error(err);
		}
	}
}

export async function getAbiFromNetwork({ address, type, star }: { address?: string, type?: ABIType, star?: string }) {
	var opts = {cacheTime: utils2.prod ? 24*3600*1000/*1d*/ : 2e5/*200s*/};
	if (address) {
		var {data} = await dasset.post('contract/getAbiByAddress', { address }, opts);
	} else if (type) {
		var types: Dict<number> = {
			[ABIType.PROOF]: 1, // 1-proof
			[ABIType.ERC20]: 2, // 2-erc20
			[ABIType.ERC721]: 3, // 3-erc721
			[ABIType.BANK]: 4, // 4-bank
			[ABIType.CASPER]: 5, // 4-casper
		};
		var tpye_ = types[type] || 1; // default 1-proof
		var {data} = await dasset.post('contract/getAbiByType', { type: tpye_, id: star, star  }, opts);
	}
	utils.assert(data, errno.ERR_GET_ABI_NOT_FOUND);
	var { address: _address, abi} = data;
	utils.assert(_address && abi, errno.ERR_GET_ABI_NOT_FOUND);
	abi = JSON.parse(abi);

	return { address: _address, abi: abi } as AbiInterface;
}

export async function getAbiFromType(type: ABIType, star?: string) {
	await fs.mkdirp(`${paths.var}/abis`);
	var name = String(type) + '_' + (star||'');
	var path = `${paths.var}/abis/abi_type_${name}.json`;
	var abi: AbiInterface|undefined;

	try {
		abi = await getAbiFromNetwork({type, star});
	} catch(err) {
		console.error(err);
	}
	if (abi) { // save cache file
		var hash = abi.hashCode();
		if (hashs[name] != hash) {
			hashs[name] = hash;
			var abi_json = JSON.stringify(abi, null, 2);
			fs.writeFileSync(path, abi_json);
			fs.writeFileSync(`${paths.var}/abis/${abi.address}.json`, abi_json);
		}
	} else {
		abi = await getLocalAbi(path); // 读取缓存文件
	}

	utils.assert(abi, errno.ERR_STAR_ADDRESS_NOT_FOUND);
	
	return abi as AbiInterface;
}

export async function getAddressFromType(type: ABIType, star?: string) {
	return (await getAbiFromType(type, star)).address;
}

export async function getAbiFromAddress(address: string) {
	await fs.mkdirp(paths.var + '/abis');
	var path = `${paths.var}/abis/${address}.json`;
	var abi = await getLocalAbi(path);
	if (!abi) {
		abi = await getAbiFromNetwork({address});
		fs.writeFileSync(path, JSON.stringify(abi, null, 2));
	}
	return abi;
}

export function getCasperAbi() {
	return getAbiFromType(ABIType.CASPER);
}