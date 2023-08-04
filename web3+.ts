/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {Web3AsyncTx, IBcWeb3} from './web3_tx';
import {createCache} from './utils';
import cfg from './cfg';
import keys from './keys+';
import {IBuffer} from 'somes/buffer';
import {Signature} from 'crypto-tx/sign';
import {Web3, Contract} from 'web3-tx';
import {getAbiByAddress} from './abi';
import {WatchCat} from 'bclib/watch';
import {get as httpGet} from './request';

async function polygon_gas(scale: number, fast?: boolean) {
	// https://api.polygonscan.com/api?module=gastracker&action=gasoracle&apikey=YourApiKeyToken
	let url = 'https://gpoly.blockscan.com/gasapi.ashx?apikey=key&method=gasoracle';
	let {data} = await httpGet(url);
	// {
	// 	"LastBlock": "42009802",
	// 	"SafeGasPrice": "503.4",
	// 	"ProposeGasPrice": "536.3",
	// 	"FastGasPrice": "540.3",
	// 	"suggestBaseFee": "502.349930113",
	// 	"gasUsedRatio": "0.7663592,0.789767766666667,0.839163843493171,0.732857252881441,0.654532866188378",
	// 	"UsdPrice": "1.007"
	// }
	let {ProposeGasPrice,FastGasPrice} = JSON.parse(data + '').result;
	return parseInt(fast?FastGasPrice:ProposeGasPrice) * 1000000000 * (scale?Number(scale)||1:1);
}

export class BcWeb3 extends Web3 implements IBcWeb3, WatchCat {
	TRANSACTION_CHECK_TIME = 5e3;

	readonly tx: Web3AsyncTx = new Web3AsyncTx(this);
	readonly chain: number;
	private _contracts: Map<string, {timeout: number, value: Contract}> = new Map();
	private _contractCacneTimeout = 3e4; // 30s

	constructor(chain: number) {
		super();
		this.chain = chain;
	}

	async contract(address: string) {
		var contract = this._contracts.get(address);
		if (!contract) {
			var {abi} = await getAbiByAddress(address, this.chain);
			contract = { value: this.createContract(address, abi), timeout: Date.now() + this._contractCacneTimeout };
			this._contracts.set(address, contract);
		}
		return contract.value;
	}

	sign(message: IBuffer, from?: string): Promise<Signature> {
		return keys.impl.sign(message, from);
	}

	defaultProvider() {
		return Array.isArray(cfg.web3) ? cfg.web3[0]: cfg.web3;
	}

	private _FetchBlockNumber = async (): Promise<number>=>{
		var num = await this.eth.getBlockNumber();
		return num;
	};

	getBlockNumber() {
		var fn = createCache(this._FetchBlockNumber, {
			cacheTime: 2e3, timeout: 1e4, id: `block_${this.chain}_${this.provider.rpc.substring(0,100)}`,
		});
		return fn();
	}

	async gasPrice() {
		if (this.chain == 137) { // polygon
			return await polygon_gas(1,false);
		} else {
			return await super.gasPrice();
		}
	}

	async cat() {
		var now = Date.now();
		for (var [k,v] of this._contracts) {
			if (v.timeout < now)
				this._contracts.delete(k);
		}
		return true;
	}

}

export default {
	get impl() {
		return this[1];
	}
} as Dict<BcWeb3>;