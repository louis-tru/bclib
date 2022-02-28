/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import web3z from '../web3+';
import {TransactionReceipt} from 'web3z';
import keys from '../keys+';
import solidity from './contracts';

export default async function({ num, from, to, value }: {
	num: number, from?: string, to?: string, value?: number
}) {
	var blockNumber = Number(num) || 1863;
	var web3 = web3z.impl.web3;
	var accounts = keys.impl.addresss;
	var address = accounts[0];
	var _value = Number(value) || 0;

	var tx1: TransactionReceipt | null = null;

	if (from && to && _value) {
		tx1 = await web3z.impl.tx.queue.push(e=>{
			return web3z.impl.sendSignTransaction({
				...e,
				to: to,
				value: '0x' + (1e18 * Math.abs(_value)).toString(16),
			});
		}, { from });
	}

	var r = {
		tx1,
		accounts: await (async ()=>{
			var balances = {} as Dict;
			for (var account of accounts) {
				balances[account] = Number(await web3.eth.getBalance(account)) / 1e18;
			}
			return balances;
		})(),
		eth_accounts: await (async ()=>{
			var accounts = await web3.eth.getAccounts();
			var balances = {} as Dict;
			for (var account of accounts) {
				balances[account] = Number(await web3.eth.getBalance(account)) / 1e18;
			}
			return balances;
		})(),
		// get nonce
		nonce: await (async () => {
			var address = '0x0Bd8c983F0cFA71da5810a876941821a53779f00';
			return {
				nonce: await web3.eth.getTransactionCount(address),
				nonceLatest: await web3.eth.getTransactionCount(address, 'latest'),
				// nonceEarliest: await web3.eth.getTransactionCount(address, 'earliest'),
				noncePending: await web3.eth.getTransactionCount(address, 'pending'),
			}
		})(),
		isListening: await web3.eth.net.isListening(),
		getNetworkType: await web3.eth.net.getNetworkType(),
		getPeerCount: await web3.eth.net.getPeerCount(),
		getId: await web3.eth.net.getId(),
		getChainId: await web3.eth.getChainId(),
		node: await web3.eth.getNodeInfo(),
		version: web3.version,
		mining: await web3.eth.isMining(),
		hashrate: await web3.eth.getHashrate(),
		// gasPrice: await web3.eth.getGasPrice(),
		code: await web3.eth.getCode(address),
		blockNumber,
		blockNumberCurrent: await web3.eth.getBlockNumber(),
		block: await web3.eth.getBlock(blockNumber),
		transactionFromBlock: tx1 && await web3.eth.getTransactionFromBlock(tx1.blockNumber, tx1.transactionIndex),
		blockTransactionCount: await web3.eth.getBlockTransactionCount(blockNumber),
		// query transaction receipts
		...await (async function() {
			var block = await web3.eth.getBlock(blockNumber);
			var transactionReceipts = [];
			var transactions = [];
			for (var i of block.transactions) {
				transactionReceipts.push(await web3.eth.getTransactionReceipt(i));
				transactions.push(await web3.eth.getTransaction(i));
			}
			return {
				transactionReceipts,
				transactions,
			}
		})(),
		// smart contract test
		...await (async function() {
			var license_types = solidity.license_types.api;//happy(address);
			var users = solidity.users.api;//happy(address);
			var logs = solidity.logs.api;//happy(address);

			var get1 = await license_types.get('11100000000019713D057').call();
			var get2 = await license_types.get('11100000000019713D006').call();

			return {
				did_users: {
					name: await users.name(address).call(),
					data: await users.data(address).call(),
				},
				license_types: {
					is_running: await license_types.isRunning().call(),
					owner: await license_types.owner().call(),
					get1, get2
				},
				// logs: {
				// 	get: await logs.get('0xc6f902b98b99ba59f2aef94888b199ac06953fe53b67bd93ae2cc1f302cac1c5'),
				// },
			};
		})(),
		tx2: await web3.eth.getTransaction('0x5696baa29a79c17d1fc45245336f8eb4a03bcf713b76ea86706aebd1b4b7e0b6'),
		tx3: await web3.eth.getTransaction('0x3b4e171879e61cffa3298d5e26f6fa5506333f3a388ce9a0de470e531a6004a6'),
	};

	return r;
}