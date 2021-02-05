/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {WatchCat} from './watch';
import * as cfg from '../config';
import accounts from './accounts';
import {IBuffer} from 'somes/buffer';
import {Signature} from 'web3z';
import {
	Web3Z, EnqueueExecArg,
	EnqueueOptions, TransactionQueue,
} from 'web3z';

class Web3IMPL extends Web3Z implements WatchCat {

	TRANSACTION_CHECK_TIME = 5e3;

	private _txQueue: TransactionQueue;

	constructor(url: string) {
		super(url, accounts.address);
		this._txQueue = new TransactionQueue(this);
		this.gasLimit = 1e6;
	}

	sign(message: IBuffer, from?: string): Promise<Signature> {
		return accounts.sign(message, from);
	}

	enqueue<R>(exec: (arg: EnqueueExecArg)=>Promise<R>, options?: EnqueueOptions): Promise<R> {
		return this._txQueue.enqueue(exec, options);
	}

	cat() {
		return true;
	}
}

export default new Web3IMPL(cfg.ethereum);