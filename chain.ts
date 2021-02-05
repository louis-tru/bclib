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
	blockNumber = ()=>web3.eth.getBlockNumber();
	isListening = ()=>web3.eth.net.isListening();
	getNetworkType = ()=>web3.eth.net.getNetworkType();
	getPeerCount = ()=>web3.eth.net.getPeerCount();
	getId = ()=>web3.eth.net.getId();
	getChainId = ()=>web3.eth.getChainId();
	getNodeInfo = ()=>web3.eth.getNodeInfo();
	version = ()=>web3.version;
	isMining = ()=>web3.eth.isMining();
	getHashrate = ()=>web3.eth.getHashrate();
	getGasPrice = ()=>web3.eth.getGasPrice();

	async getBalance({address}:{address:string}) {
		return web3.eth.getBalance(address);
	}

	async getTransactionCount({address}:{address:string}) {
		return {
			nonce: await web3.eth.getTransactionCount(address),
			nonceLatest: await web3.eth.getTransactionCount(address, 'latest'),
			nonceEarliest: await web3.eth.getTransactionCount(address, 'earliest'),
			noncePending: await web3.eth.getTransactionCount(address, 'pending'),
		}
	}

	getBlock = (
		{blockNumber, returnTransactionObjects = false}: 
		{blockNumber: BlockNumber, returnTransactionObjects?: boolean}
	)=>web3.eth.getBlock(blockNumber, returnTransactionObjects);

	getBlockUncleCount = (
		{blockNumber}: {blockNumber: BlockNumber}
	)=>web3.eth.getBlockUncleCount(blockNumber);

	getTransaction = (
		{transactionHash }: {transactionHash: string }
	)=>web3.eth.getTransaction(transactionHash);

	getPendingTransactions = ()=>web3.eth.getPendingTransactions();

	getTransactionFromBlock = (
		{blockHashOrBlockNumber, index}: {blockHashOrBlockNumber: BlockNumber, index: number}
	)=>web3.eth.getTransactionFromBlock(blockHashOrBlockNumber, index);

	getTransactionReceipt = (
		{hash}: {hash: string}
	)=>web3.eth.getTransactionReceipt(hash);

	getCoinbase = ()=>web3.eth.getCoinbase();
	getProtocolVersion = ()=>web3.eth.getProtocolVersion();
	getCode = ({address}:{address:string})=>web3.eth.getCode(address);
}