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
import {callbackTask} from './cb';
import {workers} from './env';
import db from './db';
import {WatchCat} from './watch';
import {tx_dequeue} from './env';
import storage from './storage';
import {AbiItem} from 'web3-utils';

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
	retryDelay?: number;
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

	readonly queue: MemoryTransactionQueue;

	cattime = 1; // 1 minute call cat()

	constructor(web3: IBcWeb3) {
		this._web3 = web3;
		this.queue = new MemoryTransactionQueue(web3);
	}

	private matchWorker(from: string) {
		return this._worker == Math.abs(somes.hashCode(from.toLowerCase())) % this._workers;
	}

	async cat() {
		if (!tx_dequeue) return true;
		let offset = 0, count = 0;
		while (this._sendTransactionExecuting.size < this._sendTransactionExecutingLimit) {
			let txs = await db.query<TxAsync&{qid:number}>(`
				select q.id as qid, tx_async.* from tx_async_queue as q 
					left join tx_async on q.tx_async_id = tx_async.id where q.id > ${offset} limit 1000`
			);
			if (txs.length == 0) {
				if (count)
					await somes.sleep(10 * count); // sleep 10x
				break;
			}

			for (let tx of txs) {
				try {
					if (tx.id)
						await this.dequeueItem(tx);
					else
						await db.delete('tx_async_queue', { id: tx.qid });
				} catch(err) {
					console.warn('#web3_tx.Web3Tx.dequeueAll', err);
				}
				offset = tx.id;
				count++;
			}
		}

		return true;
	}

	private async dequeueItem(tx: TxAsync) {
		if (tx.chain != this._web3.chain) return;
		if (!this.matchWorker(tx.account)) return;
		if (this._sendTransactionExecuting.has(tx.id)) return;

		if (tx.status == 1 && tx.txid) {
			var receipt = await somes.timeout(this._web3.eth.getTransactionReceipt(tx.txid), 1e4);
			var result: PostResult = { id: String(tx.id), receipt, tx };
			if (receipt) {
				if (!receipt.status) {
					result.error = Error.new(errno_web3z.ERR_TRANSACTION_STATUS_FAIL);
				}
				await this.completeTx(tx.id, result, tx.cb);

			} else {
				if (tx.nonce) { // 如果记录过写入时的`nonce`，当`nonce`小于当前`nonce`视交易被替换
					var nonce = await this._web3.getNonce(tx.account);
					if (nonce > tx.nonce) {
						// 但不能立即执行这个判定，因为可能区块链节点的部分数据下载有延迟，也许这笔交易成功了，等到下一个区块再进行判定
						var blockNumber = await this._web3.getBlockNumber();
						if (tx.noneConfirm) {
							if (blockNumber > tx.noneConfirm + 32) {
								result.error = Error.new(errno_web3z.ERR_TRANSACTION_INVALID); // 失效
								await this.completeTx(tx.id, result, tx.cb);
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
					await this.completeTx(tx.id, result, tx.cb);
				}
			}
		}
		else if (tx.status <= 1) {
			this.pushToMemoryQueue(tx.id, tx, tx.cb);
		}
	}

	private async completeTx(id: number, result: PostResult, cb?: Callback) {
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
			status: result.tx.status, data: result.tx.data,
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

	private async pushToMemoryQueue(id: number, tx: TxAsync, cb?: Callback)
	{
		if (this._sendTransactionExecuting.has(id)) return;
		if (!this.matchWorker(tx.account)) return;

		if (tx.status > 1) {
			await db.delete('tx_async_queue', { tx_async_id: id });
			return;
		}
		this._sendTransactionExecuting.add(id);

		let self = this;
		let result: PostResult = { id: String(id), tx };

		let complete = async(error?: any, r?: TransactionReceipt)=>{
			try {
				if (error) {
					var errnos: ErrnoCode[] = [
						errno_web3z.ERR_EXECUTION_REVERTED,  // exec require fail
						errno_web3z.ERR_EXECUTION_REVERTED_Values_Invalid, // exec returns values invalid
						errno_web3z.ERR_EXECUTION_CALL_FAIL, // 合约执行错误
						errno_web3z.ERR_TRANSACTION_INSUFFICIENT_FUNDS, // insufficient funds for transaction
						errno_web3z.ERR_TRANSACTION_GAS_LIMIT, // gas limit
						errno_web3z.ERR_TRANSACTION_STATUS_FAIL, // fail
						errno_web3z.ERR_TRANSACTION_SEND_FAIL, // send fail
						errno_web3z.ERR_TRANSACTION_INVALID, // 交易失效
						errno.ERR_ETH_TRANSACTION_DISCARD, // 丢弃交易
						errno.ERR_STAR_ADDRESS_NOT_FOUND, // 协议地址未定义
						errno.ERR_GET_ABI_NOT_FOUND, // abi不存在
						errno.ERR_ETH_CONTRACT_METHOD_NO_EXIST, // 协约方法不存在
						errno.ERR_ETH_CONTRACT_METHOD_ARGS_ERR, // 协约参数错误
					];
					if ( errnos.find(([e])=>error.errno==e) ) {
						Object.assign(result, { receipt: error.receipt, error });
					} else {
						console.warn('#Web3AsyncTx.pushToMemoryQueue.complete', error);
						return; // continue watch
					}
				} else {
					result.receipt = r;
				}
				await self.completeTx(id, result, cb);

			} finally {
				self._sendTransactionExecuting.delete(id);
			}
		};

		let beforePop: SendCallback = async (txid, opts)=>{
			var nonce = opts.nonce || 0;
			try {
				await db.update('tx_async', { status: 1, txid, nonce, active: Date.now() }, { id }); // 已经发送到链上，把`txid`记录下来
			} catch(err: any) {
				await storage.set(`tx_async_${id}`, {txid, nonce}); // record to local
				throw err;
			}
		};

		try {
			await db.update('tx_async', { status: 1 }, { id });

			if (tx.contract) { // contract call
				let {contract: address,method} = tx;
				let opts: Options = JSON.parse(tx.opts);
				let args: any[] = JSON.parse(tx.args as string);
				let fn = await this.checkMethodArgs(address as string, method as string, args);
				let r = await fn.call(opts); // try call
				this.queue.push(e=>
					fn.post({ ...opts, ...e }, beforePop)
				, {...opts, id}).then(e=>complete(undefined, e)).catch(complete);
			} else { // send tx
				let opts: TxOptions = JSON.parse(tx.opts);
				this.queue.push(e=>
					this._web3.sendSignTransaction({ ...opts, ...e }, beforePop)
				, {...opts, id}).then(e=>complete(undefined, e)).catch(complete);
			}
		} catch(err: any) {
			complete(err);
		}
	}

	private async checkMethodArgs(address: string, method: string, args?: any[]) {
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

	async call(address: string, method: string, args?: any[], opts?: Options) {
		var fn = await this.checkMethodArgs(address, method, args);
		return await fn.call(opts);
	}

	async post(address: string, method: string, args?: any[], opts?: Options, cb?: Callback, noTryCall?: boolean) {
		if (noTryCall) {
			await this.checkMethodArgs(address, method, args);
		} else {
			await this.call(address, method, args, Object.assign({}, opts)); // try call
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

	async deploy(bytecode: string, abi: AbiItem[], args?: any[], opts?: Options, cb?: Callback) {
		// {
		// 	"inputs": [],
		// 	"stateMutability": "nonpayable",
		// 	"type": "constructor"
		// },
		var c = new Contract(this._web3, abi);
		let m = c.deploy({ data: bytecode, arguments: args });
		try {
			await m.call(opts);
		} catch(err: any) {
			err.errno = errno.ERR_ETH_CONTRACT_METHOD_ARGS_ERR[0];
			throw err;
		}
		let data = m.encodeABI();
		let id = await this.sendSignTransaction({...opts as any, data }, cb);
		return id;
	}

	// send tx
	async sendSignTransaction(opts: TxOptions, cb?: Callback) {
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

}