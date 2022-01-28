/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {Web3Contracts} from './web3_contract';
import {createCache} from './utils';
import cfg from './cfg';
import keys from './keys+';
import {IBuffer} from 'somes/buffer';
import {Signature} from 'web3z';
import {Web3Z, IWeb3Z as IWeb3Z_} from 'web3z';
import { TransactionQueue } from 'web3z/queue';
import { Contract } from 'web3z';
import {getAbiByAddress} from './abi';
import {StaticObject} from './obj';
import {WatchCat} from 'bclib/watch';

export interface IWeb3Z extends IWeb3Z_ {
	readonly txQueue: TransactionQueue;
	contract(address: string): Promise<Contract>;
}

export class Web3IMPL extends Web3Z implements WatchCat {
	TRANSACTION_CHECK_TIME = 5e3;

	private _txQueue?: TransactionQueue;
	private _chain = 0;
	private _contracts: Map<string, {timeout: number, value: Contract}> = new Map();
	private _contractTimeout = 3e4; // 3s

	setContractTimeout(timeout: number) {
		this._contractTimeout = Number(timeout) || 0;
		if (!this._contractTimeout) {
			this._contracts.clear();
		}
	}

	async contract(address: string, chain?: number) {
		var contract = this._contracts.get(address);
		if (!contract) {
			chain = chain || this._chain || (this._chain = await this.eth.getChainId());
			var {abi} = await getAbiByAddress(address, chain);
			contract = { value: this.createContract(address, abi), timeout: Date.now() + this._contractTimeout };
		}
		return contract.value;
	}

	deleteContract(address: string) {
		this._contracts.delete(address);
	}

	sign(message: IBuffer, from?: string): Promise<Signature> {
		return keys.impl.sign(message, from);
	}

	get txQueue() {
		if (!this._txQueue) {
			this._txQueue = new TransactionQueue(this);
		}
		return this._txQueue;
	}

	givenProvider() {
		return Array.isArray(cfg.web3) ? cfg.web3[0]: cfg.web3;
	}

	getBlockNumber() {
		var fetch = (): Promise<number>=>this.eth.getBlockNumber();
		var fn = createCache(fetch, {
			cacheTime: 1e4, timeout: 1e4, id: '__getBlockNumber_' + this.givenProvider(),
		});
		return fn();
	}

	async cat() {
		var now = Date.now();
		for (var [k,v] of this._contracts) {
			if (v.timeout < now) {
				this._contracts.delete(k);
			}
		}
		return true;
	}

}

class ExportDefault extends StaticObject<IWeb3Z> {
	protected _web3_c?: Web3Contracts;
	get web3_c() {
		if (!this._web3_c)
			this._web3_c = new Web3Contracts(this.impl);
		return this._web3_c;
	}
}

export default new ExportDefault(Web3IMPL);