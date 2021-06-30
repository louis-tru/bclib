/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-27
 */

import somes from 'somes';
import web3 from './web3+';
import { TransactionReceipt, 
	FindEventResult,TxOptions as RawTxOptions,
	SAFE_TRANSACTION_MAX_TIMEOUT } from 'web3z';
import errno_web3z from 'web3z/errno';
import {ABIType, getAddressFromType} from './abi';
import errno from './errno';
import {callbackURI} from './utils';
import db from './db';
import {WatchCat} from './watch';

export interface PostResult {
	receipt: TransactionReceipt;
	// event?: FindEventResult;
	data?: any;
	error?: Error;
	id?: string;
}

export interface Options {
	value?: string;
	from?: string;
	retry?: number;
	timeout?: number;
	blockRange?: number;
	// event?: string;
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

export abstract class ContractCall {
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
		return await web3.impl.contract(await this.getAddress());
	}

}

class TypeContract extends ContractCall {
	private _star: string;
	private _type: ABIType;
	getAddress() { return getAddressFromType(this._type, this._star) }
	constructor(_star: string, _type: ABIType, host: Web3Contracts) {
		super(host);
		this._star = _star;
		this._type = _type;
	}
}

class AddressContract extends ContractCall {
	private _address: string;
	async getAddress() {return this._address}
	constructor(_address: string, host: Web3Contracts) {
		super(host);
		this._address = _address;
	}
}

export class Web3Contracts implements WatchCat {
	private _contracts = new Map<string, ContractCall>();

	contractFromType(type: ABIType, star_?: string) {
		var star = star_ || '';
		var api = this._contracts.get(star + type);
		if (!api) {
			api = new TypeContract(star, type, this);
			this._contracts.set(star + type, api);
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
		var row = await db.getById('tx_async', Number(id)) as { status: number; data: string };
		somes.assert(row, errno.ERR_WEB3_API_POST_NON_EXIST);
		somes.assert(row.status == 2 || row.status == 3, errno.ERR_WEB3_API_POST_PENDING);
		var data = JSON.parse(row.data) as PostResult;
		return data;
	}

	private async _sendTransactionAsync(id: number, row: TxAsync,
		send: (hash?: (hash: string)=>void)=>Promise<PostResult>, cb?: Callback)
	{
		var result = { id: String(id) } as PostResult;

		if (row.status == 1 && row.txid) {
			// ... check txid
			var receipt = await web3.impl.web3.eth.getTransactionReceipt(row.txid);
			if (receipt) {
				if (receipt.status) {
					result.receipt = receipt;
				} else {
					result.error = Error.new(errno_web3z.ERR_ETH_TRANSACTION_FAIL);
				}
			} else if ( Date.now() > row.time + SAFE_TRANSACTION_MAX_TIMEOUT ) {
				result.error = Error.new(errno_web3z.ERR_ETH_TRANSACTION_FAIL);
			} else {
				return; // wait
			}
		} else if (row.status <= 1) {
			try {
				await db.update('tx_async', { status: 1 }, { id }); // TODO 标记进行中
				Object.assign(result, await send(txid=>{
					db.update('tx_async', { txid }, { id }); // 这里把`txid`记录下来
				}));
			} catch(error) {
				Object.assign(result, {error});
			}
		} else {
			return; // ignore
		}
		
		var r = await db.getById('tx_async', id) as TxAsync;
		if (r.status == 1) {
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

		// discard:
		// var event: FindEventResult | undefined;
		// if (_event) {
		// 	event = await contract.findEvent(_event,
		// 		receipt.blockNumber, receipt.transactionHash
		// 	) as FindEventResult;
		// 	somes.assert(event, errno.ERR_WEB3_API_POST_EVENT_NON_EXIST);
		// }

		return { receipt } as PostResult;
	}

	async _contractPostAsync(id: number, cb_?: Callback) {
		var row = await db.getById('tx_async', id) as TxAsync; somes.assert(row);
		this._sendTransactionAsync(id, row, async (hash)=>{
			var {contract,method} = row;
			var args: any[] = JSON.parse(row.args as string);
			var opts: Options = JSON.parse(row.opts);
			return await this.contractPost(contract as string, method as string, args, opts, hash);
		}, cb_ || row.cb);
	}

	async _sendSignTransactionAsync(id: number, cb_?: Callback) {
		var row = await db.getById('tx_async', id) as TxAsync; somes.assert(row);
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