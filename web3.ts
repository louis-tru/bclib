/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {WatchCat} from './watch';
import cfg from './cfg';
import accounts from './accounts';
import {IBuffer} from 'somes/buffer';
import {Signature} from 'web3z';
import {Web3Z} from 'web3z';
import { Options, DeOptions, TransactionQueue } from 'web3z/queue';

class Web3IMPL extends Web3Z implements WatchCat {

	TRANSACTION_CHECK_TIME = 5e3;

	private _txQueue: TransactionQueue;

	getProvider() {
		return cfg.web3;
	}

	constructor() {
		super();
		this._txQueue = new TransactionQueue(this);
		this.gasLimit = 1e6;
	}

	sign(message: IBuffer, from?: string): Promise<Signature> {
		return accounts.sign(message, from);
	}

	enqueue<R>(exec: (arg: DeOptions)=>Promise<R>, options?: Options): Promise<R> {
		return this._txQueue.push(exec, options);
	}

	cat() {
		return true;
	}
}

export default new Web3IMPL();