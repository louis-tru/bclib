/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-12
 */

import ApiController from './api';
import web3z from './web3';
import {BlockNumber} from 'web3-core/types';

const web3 = web3z.web3;

export default class extends ApiController {
	
	isSyncing = ()=>web3.eth.isSyncing();
	blockNumber = ()=>web3.getBlockNumber();
	isListening = ()=>web3.raw.eth.net.isListening();
	getNetworkType = ()=>web3.raw.eth.net.getNetworkType();
	getPeerCount = ()=>web3.raw.eth.net.getPeerCount();
	getId = ()=>web3.raw.eth.net.getId();
	getChainId = ()=>web3.raw.eth.getChainId();
	getNodeInfo = ()=>web3.raw.eth.getNodeInfo();
	version = ()=>web3.raw.version;
	isMining = ()=>web3.raw.eth.isMining();
	getHashrate = ()=>web3.raw.eth.getHashrate();
	getGasPrice = ()=>web3.raw.eth.getGasPrice();

	async getBalance({address}:{address:string}) {
		return web3.raw.eth.getBalance(address);
	}

	async getTransactionCount({address}:{address:string}) {
		return {
			nonce: await web3.raw.eth.getTransactionCount(address),
			nonceLatest: await web3.raw.eth.getTransactionCount(address, 'latest'),
			nonceEarliest: await web3.raw.eth.getTransactionCount(address, 'earliest'),
			noncePending: await web3.raw.eth.getTransactionCount(address, 'pending'),
		}
	}

	getBlock = (
		{blockNumber, returnTransactionObjects = false}: 
		{blockNumber: BlockNumber, returnTransactionObjects?: boolean}
	)=>web3.raw.eth.getBlock(blockNumber, returnTransactionObjects);

	getBlockUncleCount = (
		{blockNumber}: {blockNumber: BlockNumber}
	)=>web3.raw.eth.getBlockUncleCount(blockNumber);

	getTransaction = (
		{transactionHash }: {transactionHash: string }
	)=>web3.raw.eth.getTransaction(transactionHash);

	getPendingTransactions = ()=>web3.raw.eth.getPendingTransactions();

	getTransactionFromBlock = (
		{blockHashOrBlockNumber, index}: {blockHashOrBlockNumber: BlockNumber, index: number}
	)=>web3.raw.eth.getTransactionFromBlock(blockHashOrBlockNumber, index);

	getTransactionReceipt = (
		{hash}: {hash: string}
	)=>web3.raw.eth.getTransactionReceipt(hash);

	getCoinbase = ()=>web3.raw.eth.getCoinbase();
	getProtocolVersion = ()=>web3.raw.eth.getProtocolVersion();
	getCode = ({address}:{address:string})=>web3.raw.eth.getCode(address);
}