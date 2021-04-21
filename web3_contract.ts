/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-27
 */

import somes from 'somes';
import web3 from './web3+';
import { TransactionReceipt, FindEventResult,TxOptions } from 'web3z';
import {ABIType, getAddressFromType} from './abi';
import errno from './errno';

export interface PostResult {
	receipt: TransactionReceipt;
	event?: FindEventResult;
	data?: any;
	error?: Error;
}

export interface Options {
	from?: string;
	value?: string;
	event?: string;
}

export abstract class CallContract {
	private _host: Web3Contracts;

	constructor(host: Web3Contracts) {
		this._host = host;
	}

	abstract getAddress(): Promise<string>;

	async postSync(method: string, args?: any[], opts?: Options) {
		return await this._host.contractPost(await this.getAddress(), method, args, opts);
	}

	async post(method: string, args?: any[], opts?: Options, cb?: (r: PostResult)=>void) {
		return await this._host.contractPostAsync(await this.getAddress(), method, args, opts, cb);
	}

	async get(method: string, args?: any[], opts?: Options) {
		return await this._host.contractGet(await this.getAddress(), method, args, opts);
	}

	async contract() {
		return await web3.impl.contract(await this.getAddress());
	}

}

class StarContract extends CallContract {
	private _star: string;
	private _type: ABIType;
	getAddress() { return getAddressFromType(this._type, this._star) }
	constructor(_star: string, _type: ABIType, host: Web3Contracts) {
		super(host);
		this._star = _star;
		this._type = _type;
	}
}

class CommonContract extends CallContract {
	private _address: string;
	async getAddress() {return this._address}
	constructor(_address: string, host: Web3Contracts) {
		super(host);
		this._address = _address;
	}
}

export class Web3Contracts {
	private _contracts = new Map<string, CallContract>();
	private _postResults = new Map<string, PostResult>();

	contractFromType(type: ABIType, star_?: string) {
		var star = star_ || '';
		var api = this._contracts.get(star + type);
		if (!api) {
			api = new StarContract(star, type, this);
			this._contracts.set(star + type, api);
		}
		return api;
	}

	contract(address: string) {
		var api = this._contracts.get(address);
		if (!api) {
			api = new CommonContract(address, this)
			this._contracts.set(address, api);
		}
		return api;
	}

	review(id: string): PostResult {
		somes.assert(this._postResults.has(id), errno.ERR_WEB3_API_POST_NON_EXIST);
		var r = this._postResults.get(id) as PostResult;
		try {
			somes.assert(!r.error, r.error);
			somes.assert(r.receipt, errno.ERR_WEB3_API_POST_PENDING);
			return {
				receipt: r.receipt as TransactionReceipt,
				event: r.event,
				data: r.data,
			};
		} finally {
			// TODO auto digest this._postResults.delete(id);
		}
	}

	private async _sendSignTransactionAsync(send: ()=>Promise<PostResult>, cb?: (r: PostResult)=>void): Promise<string> 
	{
		var id = String(somes.getId());
		var result = {} as PostResult;
		this._postResults.set(id, result);

		send().then(r=>{
			Object.assign(result, r);
			cb && cb(result);
		})
		.catch(error=>{
			Object.assign(result, {error})
			cb && cb(result);
		});
		return id;
	}

	sendSignTransactionAsync(opts: TxOptions, cb?: ((r: PostResult)=>any)): Promise<string> {
		return this._sendSignTransactionAsync(async ()=>{
			return {
				receipt: await web3.impl.txQueue.push(e=>web3.impl.sendSignTransaction({...opts, ...e}), opts),
			};
		}, cb);
	}

	async contractGet(contractAddress: string, method: string, args?: any[], opts?: Options) {
		var contract = await web3.impl.contract(contractAddress);
		var fn = contract.methods[method](...(args||[]));
		var {event, ..._opts} = opts || {};
		return await fn.call(_opts);
	}

	async contractPost(contractAddress: string, method: string, args?: any[], opts?: Options) {
		var contract = await web3.impl.contract(contractAddress);
		var fn = contract.methods[method](...(args||[]));
		var {event: _event, ..._opts} = opts || {};
		await fn.call({..._opts}); // try call
		// var nonce await web3.txQueue.getNonce();
		var receipt = await web3.impl.txQueue.push(e=>fn.sendSignTransaction({..._opts, ...e}), _opts);
		var event: FindEventResult | undefined;
		if (_event) {
			event = await contract.findEvent(_event,
				receipt.blockNumber, receipt.transactionHash
			) as FindEventResult;
			somes.assert(event, errno.ERR_WEB3_API_POST_EVENT_NON_EXIST);
		}
		return { receipt, event } as PostResult;
	}

	async contractPostAsync(contractAddress: string, method: string, args?: any[], opts?: Options, cb?: (r: PostResult)=>void) {
		await this.contractGet(contractAddress, method, args, opts); // try call
		return await this._sendSignTransactionAsync(()=>this.contractPost(contractAddress, method, args, opts), cb);
	}

}