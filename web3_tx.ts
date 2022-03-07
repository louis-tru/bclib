/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-27
 */

import somes from 'somes';
import {IWeb3Z,Contract} from 'web3z';
import { TransactionReceipt,TxOptions as RawTxOptions } from 'web3z';
import errno_web3z from 'web3z/errno';
import { TransactionQueue } from 'web3z/queue';
import errno from './errno';
import {callbackURI} from './utils';
import {workers} from './env';
import db from './db';
import {WatchCat} from './watch';

export interface IBcWeb3 extends IWeb3Z {
	readonly tx: Web3Tx;
	contract(address: string): Promise<Contract>;
}

export interface PostResult {
	receipt: TransactionReceipt;
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
		var [row] = await db.select('tx_async', { id: Number(id) }) as { status: number; data: string }[];
		somes.assert(row, errno.ERR_WEB3_API_POST_NON_EXIST);
		somes.assert(row.status == 2 || row.status == 3, errno.ERR_WEB3_API_POST_PENDING);
		var data = JSON.parse(row.data) as PostResult;
		return data;
	}

	private isMatchWorker(from: string) {
		return this._worker == Math.abs(somes.hashCode(from.toLowerCase())) % this._workers;
	}

	private async _Dequeue(size: number = 1) {
		var offset = 0;
		
		while (size && this._sendTransactionExecuting.size < this._sendTransactionExecutingLimit) {
			var [tx] = await db.query<TxAsync>(
				`select * from tx_async where id>=${offset} and status < 2 order by id limit 1`);
			if (!tx) break;

			if (this.isMatchWorker(tx.account) && !this._sendTransactionExecuting.has(tx.id)) {

				if (tx.status == 1 && tx.txid) {
					var receipt = await this._web3.eth.getTransactionReceipt(tx.txid);
					if (receipt) {
						var result = { id: String(tx.id) } as PostResult;
						if (receipt.status) {
							result.receipt = receipt;
						} else {
							result.error = Error.new(errno_web3z.ERR_ETH_TRANSACTION_FAIL);
						}
						await this._pushAfter(tx.id, result, tx.cb);
					}
					if (tx.active + 1e8 > Date.now()) { // 100000秒, 30小时
						offset = tx.id + 1;
						continue; // not timeout
					}
				}

				if (tx.contract) {
					this._post(tx);
				} else {
					this._sendTx(tx);
				}
				size--;
			}

			offset = tx.id + 1;
		}
	}

	private async _pushAfter(id: number, result: PostResult, cb?: Callback) {
		var [r] = await db.select('tx_async', {id}) as TxAsync[];
		if (r.status != 1) {
			return;
		}
		var u = { status: result.error ? 3: 2, data: JSON.stringify(result) } as Dict;
		if (result.receipt) {
			u.txid = result.receipt.transactionHash;
		}
		await db.update('tx_async', u, { id }); // 
		if (cb) {
			if (typeof cb == 'string') { // callback url
				callbackURI(result, cb);
			} else {
				cb(result);
			}
		}
	}

	private async _push(id: number, tx: TxAsync,
		sendQueue: (hash?: (hash: string)=>void)=>Promise<PostResult>, cb?: Callback)
	{
		if (tx.status > 1) return;
		if (this._sendTransactionExecuting.has(id)) return;
		if (!this.isMatchWorker(tx.account)) return;

		try {
			this._sendTransactionExecuting.add(id);

			var result = { id: String(id) } as PostResult;

			try {
				await db.update('tx_async', { status: 1, active: Date.now() }, { id }); // update status
				var r = await sendQueue(txid=>{
					db.update('tx_async', { txid }, { id }); // 已经发送到链上，把`txid`记录下来
				});
				Object.assign(result, r);
			} catch(error) {
				Object.assign(result, {error});
			}

			await this._pushAfter(id, result, cb);
		} finally {
			this._sendTransactionExecuting.delete(id);
		}
	}

	private _post(tx: TxAsync, cb_?: Callback) {
		return this._push(tx.id, tx, async (hash)=>{
			var {contract: address,method} = tx;
			var args: any[] = JSON.parse(tx.args as string);
			var opts: Options = JSON.parse(tx.opts);
			var contract = await this._web3.contract(address as string);
			var fn = contract.methods[method as string](...(args||[]));
			await fn.call(opts); // try call
			return {
				receipt: await this.queue.push(e=>fn.post({...opts, ...e}, hash), opts)
			};
		}, cb_ || tx.cb);
	}

	private _sendTx(tx: TxAsync, cb_?: Callback) {
		return this._push(tx.id, tx, async (hash)=>{
			var opts: TxOptions = JSON.parse(tx.opts);
			return {
				receipt: await this.queue.push(e=>this._web3.sendSignTransaction({...opts, ...e}, hash), opts),
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
		});
		this._Dequeue();
		return String(id);
	}

	async cat() {
		await this._Dequeue(this._sendTransactionExecutingLimit);
		return true;
	}

}