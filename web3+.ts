/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {Web3Contracts} from './web3_contract';
import {createCache} from './utils';
import cfg from './cfg';
import keys from './keys+';
import {IBuffer} from 'somes/buffer';
import {Signature} from 'web3z';
import {Web3Z, IWeb3Z as IWeb3Z_} from 'web3z';
import { TransactionQueue } from 'web3z/queue';
import { Contract } from 'web3z';
import {getAbiByAddress} from './abi';
import {StaticObject} from './obj';

export interface IWeb3Z extends IWeb3Z_ {
	readonly txQueue: TransactionQueue;
	contract(address: string): Promise<Contract>;
}

export class Web3IMPL extends Web3Z {
	TRANSACTION_CHECK_TIME = 5e3;

	private _txQueue?: TransactionQueue;
	private _contracts: Dict<Contract> = {};
	private _chain = 0;

	async contract(address: string, chain?: number) {
		var contract = this._contracts[address];
		if (!contract) {
			chain = chain || this._chain || (this._chain = await this.eth.getChainId());
			var {abi} = await getAbiByAddress(address, chain);
			contract = this.createContract(address, abi);
			this._contracts[address] = contract;
		}
		return contract;
	}

	sign(message: IBuffer, from?: string): Promise<Signature> {
		return keys.impl.sign(message, from);
	}

	get txQueue() {
		if (!this._txQueue) {
			this._txQueue = new TransactionQueue(this);
		}
		return this._txQueue;
	}

	givenProvider() {
		return Array.isArray(cfg.web3) ? cfg.web3[0]: cfg.web3;
	}

	getBlockNumber() {
		var fetch = (): Promise<number>=>this.eth.getBlockNumber();
		var fn = createCache(fetch, {
			cacheTime: 1e4, timeout: 1e4, id: '__getBlockNumber_' + this.givenProvider(),
		});
		return fn();
	}

}

class ExportDefault extends StaticObject<IWeb3Z> {
	private _web3_c?: Web3Contracts;
	get web3_c() {
		if (!this._web3_c)
			this._web3_c = new Web3Contracts(this.impl);
		return this._web3_c;
	}
}

export default new ExportDefault(Web3IMPL);