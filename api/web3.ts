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

interface StarArgs extends Args_ {
	star?: string;
}

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

	contractAddress({type,star}: {type: ABIType, star?: string}) {
		return web3.web3_c.contractFromType(type,star).getAddress();
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
	bankGet({star, method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.BANK, star).get(method, args);
	}
	erc20Get({star, method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.ERC20, star).get(method, args);
	}
	erc721Get({star, method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.ERC721, star).get(method, args);
	}
	proofGet({star, method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.PROOF, star).get(method, args);
	}
	casperGet({star, method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.CASPER, star).get(method, args);
	}
	starGet({star, method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.STAR, star).get(method, args);
	}
	minerGet({star, method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.MINER, star).get(method, args);
	}
	miningGet({star, method, args}: StarArgs) {
		return web3.web3_c.contractFromType(ABIType.MINING, star).get(method, args);
	}
	
	// post
	async bankPost({star, method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.BANK, star).post(method, args, opts, callback);
	}
	async erc20Post({star, method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.ERC20, star).post(method, args, opts, callback);
	}
	async erc721Post({ star, method, args, callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.ERC20, star).post(method, args, opts, callback);
	}
	async proofPost({star, method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.PROOF, star).post(method, args, opts, callback);
	}
	async casperPost({star, method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.CASPER, star).post(method, args, opts, callback);
	}
	async starPost({star, method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.STAR, star).post(method, args, opts, callback);
	}
	async minerPost({star, method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.MINING, star).post(method, args, opts, callback);
	}
	async miningPost({star, method, args,callback,...opts}: StarArgs) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3.web3_c.contractFromType(ABIType.MINING, star).post(method, args, opts, callback);
	}

}