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
import {Web3Z, IWeb3Z as IWeb3ZBase} from 'web3z';
import { TransactionQueue } from 'web3z/queue';
import { Contract } from 'web3z';
import {getAbiFromAddress} from './abi';

export interface IWeb3Z extends IWeb3ZBase {
	readonly txQueue: TransactionQueue;
	contract(address: string): Promise<Contract>;
}

export class Web3IMPL extends Web3Z {

	TRANSACTION_CHECK_TIME = 5e3;
	private _txQueue?: TransactionQueue;
	private _contracts: Dict<Contract> = {};

	async contract(address: string) {
		var contract = this._contracts[address];
		if (!contract) {
			var {abi} = await getAbiFromAddress(address);
			contract = this.createContract(address, abi);
			this._contracts[address] = contract;
		}
		return contract;
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

	getProvider() {
		this.gasLimit = 1e6;
		return Array.isArray(cfg.web3) ? cfg.web3[0]: cfg.web3;
	}

	getBlockNumber() {
		var fetch = (): Promise<number>=>this.eth.getBlockNumber();
		var fn = createCache(fetch, {
			cacheTime: 1e4, timeout: 1e4, id: '__getBlockNumber'
		});
		return fn();
	}
}

var _web3: IWeb3Z | undefined;
var _web3_c: Web3Contracts | undefined;

export default {

	get impl() {
		if (!_web3) {
			_web3 = new Web3IMPL();
		}
		return _web3;
	},

	set_impl(impl: IWeb3Z) {
		_web3 = impl;
	},

	get web3_c() {
		if (!_web3_c) {
			_web3_c = new Web3Contracts();
		}
		return _web3_c;
	},

	set_web3_c(web3_c: Web3Contracts) {
		_web3_c = web3_c;
	},

};