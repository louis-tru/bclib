/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import {Web3} from 'web3z';
import * as utils from 'web3-utils';
import cfg from '../cfg';

const SAFE_TRANSACTION_MAX_TIMEOUT = 180 * 1e3;  // 180秒

var web3: Web3 | null = null;

function getWeb3() {
	if (!web3) {
		var url = cfg.web3;
		var { HttpProvider, WebsocketProvider } = Web3.providers;
		var provider;
		if (/^https?:/.test(url)) {
			provider = new HttpProvider(url, { timeout: SAFE_TRANSACTION_MAX_TIMEOUT });
		} else if (/^wss?:/.test(url)) {
			provider = new WebsocketProvider(url, { timeout: SAFE_TRANSACTION_MAX_TIMEOUT });
		} else {
			// web3Provider = new Web3.providers.HttpProvider('http://120.132.94.167:18545');
			throw Error(`Can't create 'Web3 provider`);
		}
		web3 = new Web3(provider);

		var requestManager = (web3 as any)._requestManager;

		console.log(requestManager);
	}
	return web3;
}

export default async function({num}:{num: number}) {
	var blockNumber = Number(num) || 1863;
	var web3 = getWeb3();

	var privateKey = web3.eth.accounts.privateKeyToAccount(
		'ae023fa86ce2fa2a9614e91c1608054c1bd2b20729f425bb9d3423565d62e358');
	var privateKey1 = web3.eth.accounts.privateKeyToAccount(
		'49157152154d23a51064f53d459a8a33f74de7ac872ee43dd5eb1e66fcca8641');
	var address = utils.toChecksumAddress(privateKey.address);
	var address1 = utils.toChecksumAddress(privateKey1.address);
	var balance = await web3.eth.getBalance(address);
	var balance1 = await web3.eth.getBalance(address1);

	// web3.eth

	var isListening = await web3.eth.net.isListening();
	var getNetworkType = await web3.eth.net.getNetworkType();
	var getPeerCount = await web3.eth.net.getPeerCount();
	var getId = await web3.eth.net.getId();
	var node = await web3.eth.getNodeInfo();
	var version = web3.version;
	var mining = await web3.eth.isMining();
	var hashrate = await web3.eth.getHashrate();
	// var gasPrice = await web3.eth.getGasPrice();
	var accounts = await web3.eth.getAccounts();
	var code = await web3.eth.getCode(address);

	// query transaction receipts
	var blockNumberCurrent = await web3.eth.getBlockNumber();
	var block = await web3.eth.getBlock(blockNumber);
	// var transactionFromBlock = await web3.eth.getTransactionFromBlock(blockNumber, blockNumber);
	var blockTransactionCount = await web3.eth.getBlockTransactionCount(blockNumber);
	var transactionReceipts = [];
	var transactions = [];
	for (var i of block.transactions) {
		transactionReceipts.push(await web3.eth.getTransactionReceipt(i));
		transactions.push(await web3.eth.getTransaction(i));
	}

	// var r = await web3.eth.getTransaction(
	// '0xe4ffcedbf0d96e2c6365d0b52a0668a8b1d4243198d81cc60f425ff7320fc0e8');

	// get nonce
	var nonce = await web3.eth.getTransactionCount(address);
	var nonceLatest = await web3.eth.getTransactionCount(address, 'latest');
	var nonceEarliest = await web3.eth.getTransactionCount(address, 'earliest');
	var noncePending = await web3.eth.getTransactionCount(address, 'pending');

	// contract
	// var address = '0x0', abi = {};
	// var contract = new web3.eth.Contract(abi, address, { from: account });
	// var estimateGas = await contract.methods.balanceOf(account).estimateGas();
	// var owner = await contract.methods.owner().call();
	// var Token = await contract.methods.balanceOf(account).call();
	// var min = await contract.methods.getMinimumDeposit().call();
	// var max = await contract.methods.getMaximumDeposit().call();
	
	return {
		privateKey, privateKey1,
		balance, balance1,
		// ascii,
		// hash,
		// hashOfHash,
		isListening,
		getNetworkType,
		getPeerCount,
		getId,
		node,
		version,
		mining,
		hashrate,
		// gasPrice,
		accounts,
		code,
		blockNumber,
		blockNumberCurrent,
		block,
		// transactionFromBlock,
		blockTransactionCount,
		transactionReceipts,
		transactions,
		nonce: {
			nonce,
			nonceLatest,
			nonceEarliest,
			noncePending,
		},
		// owner,
		// estimateGas,
		// Token,
		// min,
		// max,
	};
};