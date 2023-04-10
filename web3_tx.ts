/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-27
 */

import somes from 'somes';
import { TransactionReceipt,
		TxOptions as RawTxOptions,
		IWeb3, Contract,SendCallback } from 'web3-tx';
import errno_web3z from 'web3-tx/errno';
import { MemoryTransactionQueue } from 'web3-tx/queue';
import errno from './errno';
import {callbackTask} from './utils';
import {workers} from './env';
import db from './db';
import {WatchCat} from './watch';
import {web3_tx_dequeue} from './env';
import local_storage from './storage';

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
	retry?: number; // queue retry
	timeout?: number;
	blockRange?: number;
	nonceTimeout?: number;
}

export type TxOptions = Options & RawTxOptions;

export type Callback = ((r: PostResult)=>void) | string;

type TxComplete = (r: TransactionReceipt)=>void;
type TxError = (r: Error)=>void;

export interface TxAsync {
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
	//private _offset_id = 0;

	readonly queue: MemoryTransactionQueue;

	cattime = 1; // 1 minute call cat()

	constructor(web3: IBcWeb3) {
		this._web3 = web3;
		this.queue = new MemoryTransactionQueue(web3);
	}

	private isMatchWorker(from: string) {
		console.log("postchain cat isMatchWorker",Math.abs(somes.hashCode(from.toLowerCase())), this._workers,);
		return this._worker == Math.abs(somes.hashCode(from.toLowerCase())) % this._workers;
	}

	private async _Dequeue() {
		if (!web3_tx_dequeue) return;
		var offset = 0;
		while (this._sendTransactionExecuting.size < this._sendTransactionExecutingLimit) {
			var txs = await db.query<TxAsync&{qid:number}>(`
				select q.id as qid, tx_async.* from tx_async_queue as q left join tx_async on q.tx_async_id = tx_async.id where q.id > ${offset} limit 1000`
			);
			if (txs.length == 0) break; // none

			for (var tx of txs) {
				try {
					if (tx.id)
						await this._DequeueItem(tx);
					else
						await db.delete('tx_async_queue', { id: tx.qid });
				} catch(err) {
					console.warn('web3_tx#Web3Tx#_Dequeue', err);
				}
				offset = tx.id;
			}
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
							if (blockNumber > tx.noneConfirm + 32) {
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
		else if (tx.status <= 1) {
			if (tx.contract) {
				await this._post(tx);
			} else {
				await this._send(tx);
			}
		}
	}

	private async _pushAfter(id: number, result: PostResult, cb?: Callback) {
		
		var [r] = await db.select<TxAsync>('tx_async', {id});
		if (r.status != 1) {
			return;
		}

		let {error, receipt} = result;

		if (receipt)
			receipt.logs = []; // logs数据太大存不了

		result.id = String(id);
		result.tx.status = error ? 3: 2;
		result.tx.data = JSON.stringify({ error, receipt });

		await db.update('tx_async', {
			status: result.tx.status, data: result.tx.data,time:Date.now()
		}, { id });

		if (cb) {
			if (typeof cb == 'string') { // callback url
				callbackTask.add(result, cb);
			} else {
				cb(result);
			}
		}

		await db.delete('tx_async_queue', {tx_async_id: id}); // delete queue
	}

	private async _pushTo(id: number, tx: TxAsync,
		sendQueue: (before: SendCallback, c: TxComplete, e: TxError)=>Promise<void>, cb?: Callback)
	{
		if (this._sendTransactionExecuting.has(id)) return;
		if (!this.isMatchWorker(tx.account)) return;

		if (tx.status > 1) {
			await db.delete('tx_async_queue', { tx_async_id: id });
			return;
		}

		this._sendTransactionExecuting.add(id);

		var self = this;
		var result: PostResult = { id: String(id), tx };

		async function complete(error?: any, r?: TransactionReceipt) {
			try {
				if (error) {
					var errnos: ErrnoCode[] = [
						errno_web3z.ERR_TRANSACTION_STATUS_FAIL, // fail
						errno_web3z.ERR_TRANSACTION_SEND_FAIL, // send fail
						errno_web3z.ERR_TRANSACTION_INVALID, // 交易失效
						errno_web3z.ERR_EXECUTION_REVERTED,  // exec require fail
						errno_web3z.ERR_SOLIDITY_EXEC_ERROR, // 合约执行错误
						errno_web3z.ERR_INSUFFICIENT_FUNDS_FOR_TX, // insufficient funds for transaction
						errno_web3z.ERR_GAS_REQUIRED_LIMIT, // gas limit
						errno.ERR_ETH_TRANSACTION_DISCARD, // 丢弃交易
						errno.ERR_STAR_ADDRESS_NOT_FOUND, // 协议地址未定义
						errno.ERR_GET_ABI_NOT_FOUND, // abi不存在
						errno.ERR_ETH_CONTRACT_METHOD_NO_EXIST, // 协约方法不存在
						errno.ERR_ETH_CONTRACT_METHOD_ARGS_ERR, // 协约参数错误
					];
					if ( errnos.find(([e])=>error.errno==e) ) {
						Object.assign(result, { receipt: error.receipt, error });
					} else {
						console.warn('Web3AsyncTx#_pushTo', error);
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

	private async verificMethodArguments(address: string, method: string, args?: any[]) {
		
		var contract = await this._web3.contract(address);
		var fn = contract.methods[method as string];
		somes.assert(fn, errno.ERR_ETH_CONTRACT_METHOD_NO_EXIST);
		try {
			var fnSend = fn(...(args||[]));
			return fnSend;
		} catch(err: any) {
			err.errno = errno.ERR_ETH_CONTRACT_METHOD_ARGS_ERR[0];
			throw err;
		}
	}

	private _post(tx: TxAsync, cb?: Callback) {
		return this._pushTo(tx.id, tx, async (before, complete, err)=>{

			var {contract: address,method} = tx;
			var args: any[] = JSON.parse(tx.args as string);
			var opts: Options = JSON.parse(tx.opts);

			var fn = await this.verificMethodArguments(address as string, method as string, args);
			var r = await fn.call(opts); // try call

			this.queue.push(e=>
				fn.post({ ...opts, ...e }, before)
			, opts).then(complete).catch(err);
		}, cb || tx.cb);
	}

	private _send(tx: TxAsync, cb?: Callback) {
		return this._pushTo(tx.id, tx, async (before, complete, err)=>{
			var opts: TxOptions = JSON.parse(tx.opts);

			this.queue.push(e=>
				this._web3.sendSignTransaction({ ...opts, ...e }, before)
			, opts).then(complete).catch(err);
		}, cb || tx.cb);
	}

	// ------------------ public ------------------

	async review(id: string): Promise<PostResult> {
		var [tx] = await db.select<TxAsync>('tx_async', { id: Number(id) });
		somes.assert(tx, errno.ERR_WEB3_API_POST_NON_EXIST);
		if (tx.status < 2)
			throw Error.new(errno.ERR_WEB3_API_POST_PENDING).ext({ txid: tx.txid, nonce: tx.nonce });
		// somes.assert(tx.status == 2 || tx.status == 3, errno.ERR_WEB3_API_POST_PENDING);
		var data = JSON.parse(tx.data || '');
		return { ...data, id: String(tx.id), tx };
	}

	async get(address: string, method: string, args?: any[], opts?: Options) {
		var fn = await this.verificMethodArguments(address, method, args);
		return await fn.call(opts);
	}

	async post(address: string, method: string, args?: any[], opts?: Options, cb?: Callback, noTryCall?: boolean) {
		if (noTryCall) {
			await this.verificMethodArguments(address, method, args);
		} else {
			await this.get(address, method, args, Object.assign({}, opts)); // try call
		}
		var id = await db.transaction(async db=>{
			var id = await db.insert('tx_async', {
				account: opts?.from || '',
				contract: address, method: method,
				args: JSON.stringify(args || []),
				opts: JSON.stringify(opts || {}),
				cb: typeof cb == 'string' ? cb: null,
				time: Date.now(),
				chain: this._web3.chain,
			});
			await db.insert('tx_async_queue', { tx_async_id: id });
			return id;
		});
		return String(id);
	}

	// send tx
	async send(opts: TxOptions, cb?: Callback) {
		var id = await db.transaction(async db=>{
			var id = await db.insert('tx_async', {
				account: opts.from,
				opts: JSON.stringify(opts),
				cb: typeof cb == 'string' ? cb: null,
				time: Date.now(),
				chain: this._web3.chain,
			});
			await db.insert('tx_async_queue', { tx_async_id: id });
			return id;
		});
		return String(id);
	}

	async cat() {
		await this._Dequeue();
		return true;
	}

}