/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {Web3AsyncTx, IBcWeb3} from './web3_tx';
import {createCache} from './utils';
import cfg from './cfg';
import keys from './keys+';
import {IBuffer} from 'somes/buffer';
import {Signature} from 'web3-tx';
import {Web3Tx, Contract} from 'web3-tx';
import {getAbiByAddress} from './abi';
import {WatchCat} from 'bclib/watch';

export class BcWeb3 extends Web3Tx implements IBcWeb3, WatchCat {
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
			cacheTime: 1e4, timeout: 1e4, id: '__getBlockNumber_' + this.provider.rpc,
		});
		return fn();
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