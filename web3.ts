/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import utils, {createCache} from './utils';
import {WatchCat} from './watch';
import cfg from './cfg';
import keys from './keys';
import {IBuffer} from 'somes/buffer';
import {Signature} from 'web3z';
import {Web3Z} from 'web3z';
import { TransactionQueue } from 'web3z/queue';
import { Contract } from 'web3z';
import {getAbiFromAddress} from './abi';

class Web3IMPL extends Web3Z implements WatchCat {

	TRANSACTION_CHECK_TIME = 5e3;
	private _txQueue: TransactionQueue = new TransactionQueue(this);
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
		return keys.sign(message, from);
	}

	get txQueue() {
		return this._txQueue;
	}

	getProvider() {
		this.gasLimit = 1e6;
		return cfg.web3;
	}

	getBlockNumber() {
		var fetch = (): Promise<number>=>this.eth.getBlockNumber();
		var fn = createCache(fetch, {
			cacheTime: 1e4, timeout: 1e4, id: '__getBlockNumber'
		});
		return fn();
	}

	cat() {
		return true;
	}
}

export default new Web3IMPL();