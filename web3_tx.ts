/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-27
 */

import somes from 'somes';
import { TransactionReceipt,
		TxOptions as RawTxOptions,
		IWeb3Z,Contract,SendCallback } from 'web3z';
import errno_web3z from 'web3z/errno';
import { TransactionQueue } from 'web3z/queue';
import errno from './errno';
import {callbackURI} from './utils';
import {workers} from './env';
import db from './db';
import {WatchCat} from './watch';
import {web3_tx_dequeue} from './env';

export interface IBcWeb3 extends IWeb3Z {
	readonly tx: Web3Tx;
	readonly chain: number;
	contract(address: string): Promise<Contract>;
}

export interface PostResult {
	receipt?: TransactionReceipt;
	error?: Error;
	id?: string;
}

export interface Options {
	from: string;
	value?: string;
	retry?: number;
	timeout?: number;
	blockRange?: number;
}

export type TxOptions = Options & RawTxOptions;

export type Callback = ((r: PostResult)=>void) | string;

interface TxAsync {
	id: number;
	account: string;
	contract?: string;
	method?: string;
	args?: string;
	opts: string;
	data?: string;
	cb?: string;
	txid?: string;
	status: number;
	time: number;
	active: number;
	chain: number;
	nonce: number;
	noneConfirm: number;
};

export class Web3Tx implements WatchCat {
	private _web3: IBcWeb3;
	// multi worker env
	private _workers = workers ? workers.workers: 1;
	private _worker = workers ? workers.worker: 0;
	private _sendTransactionExecuting = new Set<number>();
	private _sendTransactionExecutingLimit = 1e5; // 10000

	readonly queue: TransactionQueue;

	cattime = 1; // 1 minute call cat()

	constructor(web3: IBcWeb3) {
		this._web3 = web3;
		this.queue = new TransactionQueue(web3);
	}

	async review(id: string): Promise<PostResult> {
		var [row] = await db.select<TxAsync>('tx_async', { id: Number(id) });
		somes.assert(row, errno.ERR_WEB3_API_POST_NON_EXIST);
		if (row.status < 2)
			throw Error.new(errno.ERR_WEB3_API_POST_PENDING).ext({ txid: row.txid, nonce: row.nonce });
		// somes.assert(row.status == 2 || row.status == 3, errno.ERR_WEB3_API_POST_PENDING);
		var data = JSON.parse(row.data || '') as PostResult;
		return data;
	}

	private isMatchWorker(from: string) {
		return this._worker == Math.abs(somes.hashCode(from.toLowerCase())) % this._workers;
	}

	private async _Dequeue(size: number = 1) {
		if (!web3_tx_dequeue) return;

		var offset = 0;

		while (size && this._sendTransactionExecuting.size < this._sendTransactionExecutingLimit) {
			var [tx] = await db.query<TxAsync>(
				`select * from tx_async where id>=${offset} and status < 2 order by id limit 1`);
			if (!tx) break; // none
			try {
				if (await this._DequeueItem(tx)) {
					size--;
				}
			} catch(err) {
				console.warn('web3_tx#Web3Tx#_Dequeue', err);
			}
			offset = tx.id + 1;
		}
	}

	private async _DequeueItem(tx: TxAsync) {
		if (tx.chain != this._web3.chain) return;
		if (!this.isMatchWorker(tx.account)) return;

		if (
			!this._sendTransactionExecuting.has(tx.id)
		) {
			if (tx.status == 1 && tx.txid) {
				var receipt = await this._web3.eth.getTransactionReceipt(tx.txid);
				if (receipt) {
					var result = { id: String(tx.id), receipt } as PostResult;
					if (!receipt.status) {
						result.error = Error.new(errno_web3z.ERR_TRANSACTION_STATUS_FAIL);
					}
					await this._pushAfter(tx.id, result, tx.cb);
				}

				if (tx.nonce) {
					var nonce = await this._web3.getNonce(tx.account);
					if (nonce > tx.nonce) {
						var blockNumber = await this._web3.getBlockNumber();
						if (tx.noneConfirm) {
							if (blockNumber > tx.noneConfirm) {
								var error = Error.new(errno_web3z.ERR_TRANSACTION_INVALID);
								await this._pushAfter(tx.id, { error }, tx.cb);
							}
						} else {
							tx.noneConfirm = blockNumber;
							await db.update('tx_async', { noneConfirm: blockNumber}, { id: tx.id });
						}

						return true;
					}
				}

				if (Date.now() > tx.active + 1e8) { // 100000秒, 超过30小时后丢弃此交易
					var error = Error.new(errno.ERR_ETH_TRANSACTION_DISCARD);
					await this._pushAfter(tx.id, { error }, tx.cb);
				}
			}
			else {
				// exec
				if (tx.contract) {
					this._post(tx);
				} else {
					this._sendTx(tx);
				}
			}
		}

		return true;
	}

	private async _pushAfter(id: number, result: PostResult, cb?: Callback) {
		var [r] = await db.select('tx_async', {id}) as TxAsync[];
		if (r.status != 1) {
			return;
		}

		result.id = String(id);

		await db.update('tx_async', {
			status: result.error ? 3: 2, data: JSON.stringify(result)
		}, { id });

		if (cb) {
			if (typeof cb == 'string') { // callback url
				callbackURI(result, cb);
			} else {
				cb(result);
			}
		}
	}

	private async _push(id: number, tx: TxAsync,
		sendQueue: (cb?: SendCallback)=>Promise<PostResult>, cb?: Callback)
	{
		if (tx.status > 1) return;
		if (this._sendTransactionExecuting.has(id)) return;
		if (!this.isMatchWorker(tx.account)) return;

		try {
			this._sendTransactionExecuting.add(id);

			var result = { id: String(id) } as PostResult;

			try {
				await db.update('tx_async', { status: 1, active: Date.now() }, { id }); // update status
				var r = await sendQueue((txid, opts)=>{
					var nonce = opts.nonce || 0;
					db.update('tx_async', { txid, nonce }, { id }); // 已经发送到链上，把`txid`记录下来
				});
				Object.assign(result, r);
			} catch(error: any) {
				if (error.errno == errno_web3z.ERR_TRANSACTION_INVALID[0]
					|| error.errno == errno.ERR_SOLIDITY_EXEC_ERROR[0]
				) {
					Object.assign(result, { receipt: error.receipt, error });
				} else {
					return; // continue watch
				}
			}

			await this._pushAfter(id, result, cb);

		} finally {
			this._sendTransactionExecuting.delete(id);
		}
	}

	private _post(tx: TxAsync, cb_?: Callback) {
		return this._push(tx.id, tx, async (cb)=>{

			var {contract: address,method} = tx;
			var args: any[] = JSON.parse(tx.args as string);
			var opts: Options = JSON.parse(tx.opts);
			var contract = await this._web3.contract(address as string);
			var fn = contract.methods[method as string](...(args||[]));
			try {
				var r = await fn.call(opts); // try call
			} catch(err: any) {
				if (err.message.indexOf('execution reverted:') != -1) {
					err.errno = errno.ERR_SOLIDITY_EXEC_ERROR[0];
				}
				throw err;
			}
			return {
				receipt: await this.queue.push(({nonceTimeout, ...e})=>fn.post({
					tineout: nonceTimeout, ...opts, ...e
				}, cb), {
					queueTimeout: 0, ...opts
				}),
			};
			
		}, cb_ || tx.cb);
	}

	private _sendTx(tx: TxAsync, cb_?: Callback) {
		return this._push(tx.id, tx, async (cb)=>{

			var opts: TxOptions = JSON.parse(tx.opts);
			return {
				receipt: await this.queue.push(({nonceTimeout, ...e})=>this._web3.sendSignTransaction({
					tineout: nonceTimeout, ...opts, ...e
				}, cb), {
					queueTimeout: 0, ...opts
				}),
			};

		}, cb_ || tx.cb);
	}

	async get(address: string, method: string, args?: any[], opts?: Options) {
		var contract = await this._web3.contract(address);
		var fn = contract.methods[method](...(args||[]));
		return await fn.call(opts);
	}

	async post(address: string, method: string, args?: any[], opts?: Options, cb?: Callback) {
		await this.get(address, method, args, opts); // try call
		var id = await db.insert('tx_async', {
			account: opts?.from || '',
			contract: address, method: method,
			args: JSON.stringify(args || []),
			opts: JSON.stringify(opts || {}),
			cb: typeof cb == 'string' ? cb: null,
			time: Date.now(),
			chain: this._web3.chain,
		});
		this._Dequeue();
		return String(id);
	}

	async sendTx(opts: TxOptions, cb?: Callback) {
		var id = await db.insert('tx_async', {
			account: opts.from,
			opts: JSON.stringify(opts),
			cb: typeof cb == 'string' ? cb: null,
			time: Date.now(),
			chain: this._web3.chain,
		});
		this._Dequeue();
		return String(id);
	}

	async cat() {
		await this._Dequeue(this._sendTransactionExecutingLimit);
		return true;
	}

}