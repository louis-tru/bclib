/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-12
 */

import ApiController from '../api';
import web3s from '../web3+';
import {BlockNumber} from 'web3-core/types';

export default class extends ApiController {

	private _web3() { return web3s[Number(this.params.chain || this.headers.chain) || 1] };

	onAuth() {
		return Promise.resolve(true);
	}

	isSyncing() { return this._web3().eth.isSyncing(); }
	blockNumber() { return this._web3().eth.getBlockNumber(); }
	blockNumberCache() { return this._web3().getBlockNumber(); }
	isListening() { return this._web3().eth.net.isListening(); }
	getNetworkType() { return this._web3().eth.net.getNetworkType(); }
	getPeerCount() { return this._web3().eth.net.getPeerCount(); }
	getId() { return this._web3().eth.net.getId(); }
	getChainId() { return this._web3().eth.getChainId(); }
	getNodeInfo() { return this._web3().eth.getNodeInfo(); }
	version() { return this._web3().version; }
	isMining() { return this._web3().eth.isMining(); }
	getHashrate() { return this._web3().eth.getHashrate(); }
	getGasPrice() { return this._web3().eth.getGasPrice(); }

	getNonce({from}: {from: string}) {
		return this._web3().getNonce(from);
	}

	async getBalance({address}:{address:string}) {
		return this._web3().eth.getBalance(address);
	}

	async getTransactionCount({address}:{address:string}) {
		return {
			nonce: await this._web3().eth.getTransactionCount(address),
			nonceLatest: await this._web3().eth.getTransactionCount(address, 'latest'),
			nonceEarliest: await this._web3().eth.getTransactionCount(address, 'earliest'),
			noncePending: await this._web3().eth.getTransactionCount(address, 'pending'),
		}
	}

	getBlock(
		{blockNumber, returnTransactionObjects = false}: 
		{blockNumber: BlockNumber, returnTransactionObjects?: boolean}
	) { return this._web3().eth.getBlock(blockNumber, returnTransactionObjects); }

	getBlockUncleCount(
		{blockNumber}: {blockNumber: BlockNumber}
	) { return this._web3().eth.getBlockUncleCount(blockNumber); }

	getTransaction(
		{transactionHash }: {transactionHash: string }
	) { this._web3().eth.getTransaction(transactionHash); }

	getPendingTransactions() { return this._web3().eth.getPendingTransactions(); }

	getTransactionFromBlock(
		{blockHashOrBlockNumber, index}: {blockHashOrBlockNumber: BlockNumber, index: number}
	) { return this._web3().eth.getTransactionFromBlock(blockHashOrBlockNumber, index); }

	getTransactionReceipt(
		{hash}: {hash: string}
	) { return this._web3().eth.getTransactionReceipt(hash); }

	getCoinbase() { return this._web3().eth.getCoinbase(); }
	getProtocolVersion() { return this._web3().eth.getProtocolVersion(); }
	getCode({address}:{address:string}) { return this._web3().eth.getCode(address); }
}