/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-27
 */

import somes from 'somes';
import web3 from './web3';
import { TransactionReceipt, FindEventResult } from 'web3z';
import {ABIType, getAddressFromType} from './abi';
import errno from './errno';

export interface PostResult {
	receipt: TransactionReceipt;
	event?: FindEventResult;
	data?: any;
}

interface _PostResult {
	receipt?: TransactionReceipt;
	event?: FindEventResult;
	error?: Error;
	data?: any;
}

export abstract class AbstractContractWrap {
	private _postResults: Map<string, _PostResult>;

	constructor(postResultStore: Map<string, _PostResult>) {
		this._postResults = postResultStore;
	}

	abstract getAddress(): Promise<string>;

	async postSync(method: string, args?: any[], queryEvent?: string) {
		var contract = await this.contract();
		var fn = contract.methods[method](...(args||[]));
		var receipt = await web3.txQueue.push(e=>fn.sendSignTransaction(e));
		var event: FindEventResult | undefined;
		if (queryEvent) {
			event = await contract.findEvent(queryEvent, 
				receipt.blockNumber, receipt.transactionHash
			) as FindEventResult;
			somes.assert(event, errno.ERR_WEB3_API_POST_EVENT_NON_EXIST);
		}
		return { receipt, event } as PostResult;
	}

	async post(method: string, args?: any[], queryEvent?: string, complete?: ((r: PostResult)=>Promise<void>|void)) {
		var id = String(somes.getId());
		var result = {} as _PostResult;
		this._postResults.set(id, result);
		this.postSync(method, args, queryEvent).then(complete).catch(error=>Object.assign(result, {error}));
		return id;
	}

	async get(method: string, args?: any[]) {
		var contract = await this.contract();
		var fn = contract.methods[method](...(args||[]));
		return await fn.call();
	}

	async contract() {
		return await web3.contract(await this.getAddress());
	}

}

class StarContractWrap extends AbstractContractWrap {
	private _star: string;
	private _type: ABIType;
	getAddress() { return getAddressFromType(this._type, this._star) }
	constructor(_star: string, _type: ABIType, store: Map<string, _PostResult>) {
		super(store);
		this._star = _star;
		this._type = _type;
	}
}

class ContractWrap extends AbstractContractWrap {
	private _address: string;
	async getAddress() {return this._address}
	constructor(_address: string, store: Map<string, _PostResult>) {
		super(store);
		this._address = _address;
	}
}

class Contracts {
	private _contractAPIs = new Map<string, AbstractContractWrap>();
	private _postResults = new Map<string, _PostResult>();

	starContract(type: ABIType, star_?: string) {
		var star = star_ || '';
		var api = this._contractAPIs.get(star + type);
		if (!api) {
			api = new StarContractWrap(star, type, this._postResults);
			this._contractAPIs.set(star + type, api);
		}
		return api;
	}

	contract(address: string) {
		var api = this._contractAPIs.get(address);
		if (!api) {
			api = new ContractWrap(address, this._postResults)
			this._contractAPIs.set(address, api);
		}
		return api;
	}

	star(star?: string) { return this.starContract(ABIType.STAR, star) }
	erc20(star?: string) { return this.starContract(ABIType.ERC20, star) }
	bank(star?: string) { return this.starContract(ABIType.BANK, star) }
	miner(star?: string) { return this.starContract(ABIType.MINER, star) }
	mining(star?: string) { return this.starContract(ABIType.MINING, star) }
	erc721(star?: string) { return this.starContract(ABIType.ERC721, star) }

	review(id: string): PostResult {
		somes.assert(this._postResults.has(id), errno.ERR_WEB3_API_POST_NON_EXIST);
		var r = this._postResults.get(id) as _PostResult;
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

}

export default new Contracts();
