/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-12
 */

import ApiController from '../api';
import web3z from '../web3+';
import {BlockNumber} from 'web3-core/types';

const web3 = ()=>web3z.impl.web3;

export default class extends ApiController {

	async auth() {
		return true;
	}

	isSyncing() { return web3().eth.isSyncing(); }
	blockNumber() { return web3().eth.getBlockNumber(); }
	blockNumberCache() { return web3z.impl.getBlockNumber(); }
	isListening() { return web3().eth.net.isListening(); }
	getNetworkType() { return web3().eth.net.getNetworkType(); }
	getPeerCount() { return web3().eth.net.getPeerCount(); }
	getId() { return web3().eth.net.getId(); }
	getChainId() { return web3().eth.getChainId(); }
	getNodeInfo() { return web3().eth.getNodeInfo(); }
	version() { return web3().version; }
	isMining() { return web3().eth.isMining(); }
	getHashrate() { return web3().eth.getHashrate(); }
	getGasPrice() { return web3().eth.getGasPrice(); }

	async getBalance({address}:{address:string}) {
		return web3().eth.getBalance(address);
	}

	async getTransactionCount({address}:{address:string}) {
		return {
			nonce: await web3().eth.getTransactionCount(address),
			nonceLatest: await web3().eth.getTransactionCount(address, 'latest'),
			nonceEarliest: await web3().eth.getTransactionCount(address, 'earliest'),
			noncePending: await web3().eth.getTransactionCount(address, 'pending'),
		}
	}

	getBlock(
		{blockNumber, returnTransactionObjects = false}: 
		{blockNumber: BlockNumber, returnTransactionObjects?: boolean}
	) { return web3().eth.getBlock(blockNumber, returnTransactionObjects); }

	getBlockUncleCount(
		{blockNumber}: {blockNumber: BlockNumber}
	) { return web3().eth.getBlockUncleCount(blockNumber); }

	getTransaction(
		{transactionHash }: {transactionHash: string }
	) { web3().eth.getTransaction(transactionHash); }

	getPendingTransactions() { return web3().eth.getPendingTransactions(); }

	getTransactionFromBlock(
		{blockHashOrBlockNumber, index}: {blockHashOrBlockNumber: BlockNumber, index: number}
	) { return web3().eth.getTransactionFromBlock(blockHashOrBlockNumber, index); }

	getTransactionReceipt(
		{hash}: {hash: string}
	) { return web3().eth.getTransactionReceipt(hash); }

	getCoinbase() { return web3().eth.getCoinbase(); }
	getProtocolVersion() { return web3().eth.getProtocolVersion(); }
	getCode({address}:{address:string}) { return web3().eth.getCode(address); }
}