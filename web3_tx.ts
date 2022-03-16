/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-27
 */

import somes from 'somes';
import { TransactionReceipt,
		TxOptions as RawTxOptions,
		IWeb3, Contract,SendCallback } from 'web3-tx';
import errno_web3z from 'web3-tx/errno';
import { TransactionQueue } from 'web3-tx/queue';
import errno from './errno';
import {callbackTask} from './utils';
import {workers} from './env';
import db from './db';
import {WatchCat} from './watch';
import {web3_tx_dequeue} from './env';
import local_storage from './storage';
// import util from 'somes';

export interface IBcWeb3 extends IWeb3 {
	readonly tx: Web3AsyncTx;
	readonly chain: number;
	contract(address: string): Promise<Contract>;
}

export interface PostResult {
	receipt?: TransactionReceipt;
	error?: Error;
	id?: string;
	tx: TxAsync;
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

type TxComplete = (r: TransactionReceipt)=>void;
type TxError = (r: Error)=>void;

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
}

export class Web3AsyncTx implements WatchCat {
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
		var [tx] = await db.select<TxAsync>('tx_async', { id: Number(id) });
		somes.assert(tx, errno.ERR_WEB3_API_POST_NON_EXIST);
		if (tx.status < 2)
			throw Error.new(errno.ERR_WEB3_API_POST_PENDING).ext({ txid: tx.txid, nonce: tx.nonce });
		// somes.assert(tx.status == 2 || tx.status == 3, errno.ERR_WEB3_API_POST_PENDING);
		var data = JSON.parse(tx.data || '');
		return { ...data, id: tx.id, tx };
	}

	private isMatchWorker(from: string) {
		return this._worker == Math.abs(somes.hashCode(from.toLowerCase())) % this._workers;
	}

	private async _Dequeue() {
		if (!web3_tx_dequeue) return;

		var offset = 0;

		while (this._sendTransactionExecuting.size < this._sendTransactionExecutingLimit) {
			var [tx] = await db.query<TxAsync>(
				`select * from tx_async where id>=${offset} and status < 2 order by id limit 1`);
			if (!tx) break; // none

			// if (tx.account=='0x729e82FBBcAa0Af5C6057B326Ba4D536266EB74B' && tx.id==436) {
			// 	debugger;
			// }
			try {
				await this._DequeueItem(tx);
			} catch(err) {
				console.warn('web3_tx#Web3Tx#_Dequeue', err);
			}
			offset = tx.id + 1;
		}
	}

	private async _DequeueItem(tx: TxAsync) {
		if (tx.chain != this._web3.chain) return;
		if (!this.isMatchWorker(tx.account)) return;
		if (this._sendTransactionExecuting.has(tx.id)) return;

		if (tx.status == 1 && tx.txid) {
			var receipt = await somes.timeout(this._web3.eth.getTransactionReceipt(tx.txid), 1e4);
			var result: PostResult = { id: String(tx.id), receipt, tx };
			if (receipt) {
				if (!receipt.status) {
					result.error = Error.new(errno_web3z.ERR_TRANSACTION_STATUS_FAIL);
				}
				await this._pushAfter(tx.id, result, tx.cb);

			} else {
				if (tx.nonce) { // 如果记录过写入时的`nonce`，当`nonce`小于当前`nonce`视交易被替换
					var nonce = await this._web3.getNonce(tx.account);
					if (nonce > tx.nonce) {
						// 但不能立即执行这个判定，因为可能区块链节点的部分数据下载有延迟，也许这笔交易成功了，等到下一个区块再进行判定
						var blockNumber = await this._web3.getBlockNumber();
						if (tx.noneConfirm) {
							if (blockNumber > tx.noneConfirm) {
								result.error = Error.new(errno_web3z.ERR_TRANSACTION_INVALID); // 失效
								await this._pushAfter(tx.id, result, tx.cb);
							}
						} else { // 先写入确认判定失效的先决条件,在开始判定前需要等待一个区块
							tx.noneConfirm = blockNumber;
							await db.update('tx_async', { noneConfirm: blockNumber}, { id: tx.id });
						}
						return;
					}
				}

				if (Date.now() > tx.active + 1e8) {
					// 100000（30小时）后丢弃此交易，超过30小时都没有人处理这比交易，再等更多时间也没有意义
					result.error = Error.new(errno.ERR_ETH_TRANSACTION_DISCARD);
					await this._pushAfter(tx.id, result, tx.cb);
				}
			}
		}
		else {
			if (tx.contract) {
				await this._post(tx);
			} else {
				await this._sendTx(tx);
			}
		}
	}

	private async _pushAfter(id: number, result: PostResult, cb?: Callback) {
		var [r] = await db.select('tx_async', {id}) as TxAsync[];
		if (r.status != 1) {
			return;
		}

		let {error, receipt} = result;

		result.id = String(id);
		result.tx.status = error ? 3: 2;
		result.tx.data = JSON.stringify({ error, receipt });

		await db.update('tx_async', {
			status: result.tx.status, data: result.tx.data,
		}, { id });

		if (cb) {
			if (typeof cb == 'string') { // callback url
				callbackTask.add(result, cb);
			} else {
				cb(result);
			}
		}
	}

	private async _pushTo(id: number, tx: TxAsync,
		sendQueue: (before: SendCallback, c: TxComplete, e: TxError)=>Promise<void>, cb?: Callback)
	{
		if (tx.status > 1) return;
		if (!this.isMatchWorker(tx.account)) return;
		if (this._sendTransactionExecuting.has(id)) return;

		this._sendTransactionExecuting.add(id);

		var self = this;
		var result: PostResult = { id: String(id), tx };

		async function complete(error?: any, r?: TransactionReceipt) {
			try {
				if (error) {
					if ( error.errno == errno_web3z.ERR_TRANSACTION_STATUS_FAIL[0] // fail
						|| error.errno == errno_web3z.ERR_TRANSACTION_INVALID[0] // 交易失效
						|| error.errno == errno_web3z.ERR_SOLIDITY_EXEC_ERROR[0] // 合约执行错误
						//|| err.errno == errno_web3z.ERR_TRANSACTION_BLOCK_RANGE_LIMIT[0] // block limit
						//|| err.errno == errno_web3z.ERR_REQUEST_TIMEOUT[0] // timeout
					) {
						Object.assign(result, { receipt: error.receipt, error });
					} else {
						return; // continue watch
					}
				} else {
					result.receipt = r;
				}

				await self._pushAfter(id, result, cb);

			} finally {
				self._sendTransactionExecuting.delete(id);
			}
		}
	
		try {
			await db.update('tx_async', { status: 1 }, { id });
			await sendQueue(async (txid, opts)=>{
				var nonce = opts.nonce || 0;
				try {
					await db.update('tx_async', { status: 1, txid, nonce, active: Date.now() }, { id }); // 已经发送到链上，把`txid`记录下来
				} catch(err: any) {
					await local_storage.set(`tx_async_${id}`, {txid, nonce}); // record to local
					throw err;
				}
			}, (r)=>complete(undefined, r), complete);
		} catch(err: any) {
			complete(err);
		}
	}

	private _post(tx: TxAsync, cb?: Callback) {
		return this._pushTo(tx.id, tx, async (before, complete, err)=>{

			var {contract: address,method} = tx;
			var args: any[] = JSON.parse(tx.args as string);
			var opts: Options = JSON.parse(tx.opts);
			var contract = await this._web3.contract(address as string);
			var fn = contract.methods[method as string](...(args||[]));

			try {
				var r = await fn.call(opts); // try call
			} catch(err: any) {
				if (err.message.indexOf('execution reverted:') != -1) {
					err.errno = errno_web3z.ERR_SOLIDITY_EXEC_ERROR[0];
				}
				throw err;
			}

			this.queue.push(({nonceTimeout, ...e})=>{
				return fn.post({ timeout: nonceTimeout, ...opts, ...e }, before).then(complete).catch(err);
			},
			{
				queueTimeout: 0, ...opts
			});
		}, cb || tx.cb);
	}

	private _sendTx(tx: TxAsync, cb?: Callback) {
		return this._pushTo(tx.id, tx, async (before, complete, err)=>{
			var opts: TxOptions = JSON.parse(tx.opts);

			this.queue.push(({nonceTimeout, ...e})=>{
				return this._web3.sendSignTransaction({ timeout: nonceTimeout, ...opts, ...e }, before).then(complete).catch(err);
			},
			{
				queueTimeout: 0, ...opts
			});
		}, cb || tx.cb);
	}

	async get(address: string, method: string, args?: any[], opts?: Options) {
		var contract = await this._web3.contract(address);
		var fn = contract.methods[method](...(args||[]));
		return await fn.call(opts);
	}

	async post(address: string, method: string, args?: any[], opts?: Options, cb?: Callback, noTryCall?: boolean) {
		if (!noTryCall)
			await this.get(address, method, args, Object.assign({}, opts)); // try call
		var id = await db.insert('tx_async', {
			account: opts?.from || '',
			contract: address, method: method,
			args: JSON.stringify(args || []),
			opts: JSON.stringify(opts || {}),
			cb: typeof cb == 'string' ? cb: null,
			time: Date.now(),
			chain: this._web3.chain,
		});
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
		return String(id);
	}

	async cat() {
		await this._Dequeue();
		return true;
	}

}