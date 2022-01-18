/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-27
 */

import somes from 'somes';
import web3, {IWeb3Z} from './web3+';
import { TransactionReceipt, 
	FindEventResult,TxOptions as RawTxOptions } from 'web3z';
import errno_web3z from 'web3z/errno';
import {ABIType, getAddressByType} from './abi';
import errno from './errno';
import {callbackURI} from './utils';
import db from './db';
import {WatchCat} from './watch';

export interface PostResult {
	receipt: TransactionReceipt;
	event?: FindEventResult;
	error?: Error;
	id?: string;
}

export interface Options {
	value?: string;
	from?: string;
	retry?: number;
	timeout?: number;
	blockRange?: number;
	event?: string;
}

export type TxOptions = Options & RawTxOptions;

export type Callback = ((r: PostResult)=>void) | string;

interface TxAsync {
	id: number;
	account?: string;
	contract?: string;
	method?: string;
	args?: string;
	opts: string;
	data?: string;
	cb?: string;
	txid?: string;
	status: number;
	time: number;
};

export abstract class ContractWrap {
	private _host: Web3Contracts;

	constructor(host: Web3Contracts) {
		this._host = host;
	}

	abstract getAddress(): Promise<string>;

	async postSync(method: string, args?: any[], opts?: Options) {
		return await this._host.contractPost(await this.getAddress(), method, args, opts);
	}

	async post(method: string, args?: any[], opts?: Options, cb?: Callback) {
		return await this._host.contractPostAsync(await this.getAddress(), method, args, opts, cb);
	}

	async get(method: string, args?: any[], opts?: Options) {
		return await this._host.contractGet(await this.getAddress(), method, args, opts);
	}

	async contract() {
		return await this._host.web3.contract(await this.getAddress());
	}

}

class TypeContract extends ContractWrap {
	private _type: ABIType;
	getAddress() { return getAddressByType(this._type) }
	constructor(_type: ABIType, host: Web3Contracts) {
		super(host);
		this._type = _type;
	}
}

class AddressContract extends ContractWrap {
	private _address: string;
	async getAddress() {return this._address}
	constructor(_address: string, host: Web3Contracts) {
		super(host);
		this._address = _address;
	}
}

export class Web3Contracts implements WatchCat {
	private _contracts = new Map<string, ContractWrap>();
	private _web3?: IWeb3Z;

	get web3() {
		return this._web3 || web3.impl;
	}

	constructor(web3?: IWeb3Z) {
		this._web3 = web3;
	}

	contractFromType(type: ABIType) {
		var _type = String(type);
		var api = this._contracts.get(_type);
		if (!api) {
			api = new TypeContract(type, this);
			this._contracts.set(_type, api);
		}
		return api;
	}

	contract(address: string) {
		var api = this._contracts.get(address);
		if (!api) {
			api = new AddressContract(address, this)
			this._contracts.set(address, api);
		}
		return api;
	}

	async review(id: string): Promise<PostResult> {
		var [row] = await db.select('tx_async', { id: Number(id) }) as { status: number; data: string }[];
		somes.assert(row, errno.ERR_WEB3_API_POST_NON_EXIST);
		somes.assert(row.status == 2 || row.status == 3, errno.ERR_WEB3_API_POST_PENDING);
		var data = JSON.parse(row.data) as PostResult;
		return data;
	}

	private async _sendTransactionAsyncAfter(id: number, result: PostResult, cb?: Callback) {
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

	private async _sendTransactionAsyncExec(id: number, row: TxAsync,
		sendQueue: (hash?: (hash: string)=>void)=>Promise<PostResult>, cb?: Callback)
	{
		var result = { id: String(id) } as PostResult;
		if (row.txid) { // ... check txid
			var receipt = await web3.impl.web3.eth.getTransactionReceipt(row.txid);
			if (receipt) {
				if (receipt.status) {
					result.receipt = receipt;
				} else {
					result.error = Error.new(errno_web3z.ERR_ETH_TRANSACTION_FAIL);
				}
				await this._sendTransactionAsyncAfter(id, result, cb);
			}
		} else {
			try {
				var r = await sendQueue(txid=>{
					db.update('tx_async', { txid }, { id }); // TODO 这个地方txid肯定是要发送到链上，把`txid`记录下来
				});
				Object.assign(result, r);
			} catch(error) {
				Object.assign(result, {error});
			}
			await this._sendTransactionAsyncAfter(id, result, cb);
		}
	}

	private _sendTransactionAsyncExecuting = new Set<number>();

	private async _sendTransactionAsync(id: number, row: TxAsync,
		sendQueue: (hash?: (hash: string)=>void)=>Promise<PostResult>, cb?: Callback)
	{
		if (row.status != 1) {
			return;
		}
		if (this._sendTransactionAsyncExecuting.has(id)) {
			return;
		}
		try {
			this._sendTransactionAsyncExecuting.add(id);
			await this._sendTransactionAsyncExec(id, row, sendQueue, cb);
		} finally {
			this._sendTransactionAsyncExecuting.delete(id);
		}
	}

	async contractGet(contractAddress: string, method: string, args?: any[], opts?: Options) {
		var contract = await web3.impl.contract(contractAddress);
		var fn = contract.methods[method](...(args||[]));
		return await fn.call(opts);
	}

	async contractPost(contractAddress: string, method: string, args?: any[], opts?: Options, hash?: (hash: string)=>void) {
		var contract = await web3.impl.contract(contractAddress);
		var fn = contract.methods[method](...(args||[]));
		await fn.call(opts); // try call
		// var nonce = await web3.txQueue.getNonce();
		var receipt = await web3.impl.txQueue.push(e=>fn.sendSignTransaction({...opts, ...e}, hash), opts);
		var event: FindEventResult | undefined;
		if (opts?.event) {
			event = await contract.findEvent(opts.event, receipt.blockNumber, receipt.transactionHash) || undefined;
		}
		return { receipt, event } as PostResult;
	}

	async _contractPostAsync(id: number, cb_?: Callback) {
		var [row] = await db.select('tx_async', {id}) as TxAsync[]; somes.assert(row);
		this._sendTransactionAsync(id, row, async (hash)=>{
			var {contract,method} = row;
			var args: any[] = JSON.parse(row.args as string);
			var opts: Options = JSON.parse(row.opts);
			return await this.contractPost(contract as string, method as string, args, opts, hash);
		}, cb_ || row.cb);
	}

	async _sendSignTransactionAsync(id: number, cb_?: Callback) {
		var [row] = await db.select('tx_async', {id}) as TxAsync[]; somes.assert(row);
		this._sendTransactionAsync(id, row, async (hash)=>{
			var opts: TxOptions = JSON.parse(row.opts);
			return {
				receipt: await web3.impl.txQueue.push(e=>web3.impl.sendSignTransaction({...opts, ...e}, hash), opts),
			};
		}, cb_ || row.cb);
	}

	async contractPostAsync(contractAddress: string, method: string, args?: any[], opts?: Options, cb?: Callback) {
		await this.contractGet(contractAddress, method, args, opts); // try call
		var id = await db.insert('tx_async', {
			account: opts?.from,
			contract: contractAddress, method: method,
			args: JSON.stringify(args || []),
			opts: JSON.stringify(opts || {}),
			cb: typeof cb == 'string' ? cb: null,
			time: Date.now(),
			status: 1,
		});
		await this._contractPostAsync(id, cb);
		return String(id);
	}

	async sendSignTransactionAsync(opts: TxOptions, cb?: Callback) {
		var id = await db.insert('tx_async', {
			account: opts.from,
			opts: JSON.stringify(opts),
			cb: typeof cb == 'string' ? cb: null,
			time: Date.now(),
			status: 1,
		});
		await this._sendSignTransactionAsync(id, cb);
		return String(id);
	}

	cattime = 5; // 5 minute call cat()

	async cat() {
		var items = await db.select('tx_async', { status: 1 });
		for (var item of items) {
			if (item.contract) {
				this._contractPostAsync(item.id);
			} else {
				this._sendSignTransactionAsync(item.id);
			}
		}
		return true;
	}

}