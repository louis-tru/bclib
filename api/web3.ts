/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-16
 */

import APIController from '../api';
import {STOptions} from 'web3z';
import web3 from '../web3+';
import {TxOptions} from '../web3_contract';
import {ABIType} from '../abi';
import buffer from 'somes/buffer';
import keys from '../keys+';

interface Args_ {
	method: string;
	args?: any[];
	event?: string;
	from?: string;
	value?: string;
	timeout?: number;
	retry?: number;
	callback?: string;
	blockRange?: number;
}

interface Args extends Args_ {
	address: string;
}

interface StarArgs extends Args_ {}

export default class extends APIController {

	contractGet({address, method, args}: Args) {
		return web3.web3_c.contract(address).get(method, args);
	}
	async contractPost({address, method, args,callback,...opts}: Args) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contract(address).post(method, args,opts, callback);
	}
	async contractPostSync({address, method, args, callback, ...opts}: Args) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contract(address).postSync(method, args, opts);
	}

	review({id}: { id: string }) {
		return web3.web3_c.review(id);
	}

	contractAddress({type}: {type: ABIType}) {
		return web3.web3_c.contractFromType(type).getAddress();
	}

	getBlockNumber() {
		return web3.impl.getBlockNumber();
	}

	getNonce({account,from}: {account?: string, from?: string}) {
		return web3.impl.getNonce(account||from);
	}

	getNonceQueue({account,from}: {account?: string, from?: string}) {
		return web3.impl.txQueue.getNonce(account||from);
	}

	async serializedTx(tx: TxOptions) {
		await keys.impl.checkPermission(this.userName, tx.from);
		if (!tx.nonce) {
			Object.assign(tx, await web3.impl.txQueue.getNonce(tx.from));
		}
		var {data, hash} = await web3.impl.signTx(tx);
		return {
			data: '0x' + data.toString('hex'),
			txid: '0x' + hash.toString('hex'),
			nonce: tx.nonce as number,
		};
	}

	async serializedTxForContract({address, method, args,from,value}: Args) {
		await keys.impl.checkPermission(this.userName, from);
		var contract = await web3.impl.contract(address);
		var nonce = await web3.impl.txQueue.getNonce(from);
		var {data,hash} = await contract.methods[method](...args).signTx({value, ...nonce});
		return {
			data: '0x' + data.toString('hex'),
			txid: '0x' + hash.toString('hex'),
			nonce: nonce.nonce,
		};
	}

	async sendSignTransaction({tx}: {tx: TxOptions}) {
		await keys.impl.checkPermission(this.userName, tx.from);
		return await web3.impl.sendSignTransaction(tx);
	}

	async sendSignTransactionAsync({tx, callback}: {tx: TxOptions, callback?: string}) {
		await keys.impl.checkPermission(this.userName, tx.from);
		return await web3.web3_c.sendSignTransactionAsync(tx, callback);
	}

	sendSignedTransaction({serializedTx,opts}: {serializedTx: string, opts?: STOptions}) {
		return web3.impl.sendSignedTransaction(buffer.from(serializedTx.slice(2), 'hex'), opts);
	}

	//-----------------------------------------------------------------------------

	// get
	bankGet({method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.BANK).get(method, args);
	}
	erc20Get({method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.ERC20).get(method, args);
	}
	erc721Get({method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.ERC721).get(method, args);
	}
	proofGet({method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.PROOF).get(method, args);
	}
	casperGet({method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.CASPER).get(method, args);
	}
	starGet({method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.STAR).get(method, args);
	}
	minerGet({method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.MINER).get(method, args);
	}
	miningGet({method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.MINING).get(method, args);
	}
	
	// post
	async bankPost({method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.BANK).post(method, args, opts, callback);
	}
	async erc20Post({method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.ERC20).post(method, args, opts, callback);
	}
	async erc721Post({ method, args, callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.ERC20).post(method, args, opts, callback);
	}
	async proofPost({method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.PROOF).post(method, args, opts, callback);
	}
	async casperPost({method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.CASPER).post(method, args, opts, callback);
	}
	async starPost({method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.STAR).post(method, args, opts, callback);
	}
	async minerPost({method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.MINING).post(method, args, opts, callback);
	}
	async miningPost({method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.MINING).post(method, args, opts, callback);
	}

}