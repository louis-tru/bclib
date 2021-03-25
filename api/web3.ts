/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-16
 */

import ApiController from '../api';
import {TxOptions,STOptions} from 'web3z';
import web3 from '../web3+';
import web3_c from '../web3_contract';
import {ABIType} from '../abi';
import buffer from 'somes/buffer';
import keys from '../keys';
import {callbackURI} from '../utils';

interface Args_ {
	method: string;
	args?: any[];
	event?: string;
	from?: string;
	value?: string;
	callback?: string;
}

interface Args extends Args_ {
	address: string;
}

interface StarArgs extends Args_ {
	star?: string;
}

export default class extends ApiController {

	// contract call
	contractGet({address, method, args}: Args) {
		return web3_c.contract(address).get(method, args);
	}
	async contractPost({address, method, args,event,from,value,callback}: Args) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contract(address).post(method, args,{event,from,value}, e=>{
			callback && callbackURI(e, callback);
		});
	}
	async contractPostSync({address, method, args, event,from,value}: Args) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contract(address).postSync(method, args, {event,from,value});
	}

	// get
	bankGet({star, method, args}: StarArgs) {
		return web3_c.contractFromType(ABIType.BANK, star).get(method, args);
	}
	erc20Get({star, method, args}: StarArgs) {
		return web3_c.contractFromType(ABIType.ERC20, star).get(method, args);
	}
	erc721Get({star, method, args}: StarArgs) {
		return web3_c.contractFromType(ABIType.ERC721, star).get(method, args);
	}
	proofGet({star, method, args}: StarArgs) {
		return web3_c.contractFromType(ABIType.PROOF, star).get(method, args);
	}
	casperGet({star, method, args}: StarArgs) {
		return web3_c.contractFromType(ABIType.CASPER, star).get(method, args);
	}
	starGet({star, method, args}: StarArgs) {
		return web3_c.contractFromType(ABIType.STAR, star).get(method, args);
	}
	minerGet({star, method, args}: StarArgs) {
		return web3_c.contractFromType(ABIType.MINER, star).get(method, args);
	}
	miningGet({star, method, args}: StarArgs) {
		return web3_c.contractFromType(ABIType.MINING, star).get(method, args);
	}
	
	// post
	async bankPost({star, method, args, event,from,value}: StarArgs) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contractFromType(ABIType.BANK, star).post(method, args, {event,from,value});
	}
	async erc20Post({star, method, args, event,from,value}: StarArgs) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contractFromType(ABIType.ERC20, star).post(method, args, {event,from,value});
	}
	async erc721Post({ star, method, args, event,from,value}: StarArgs) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contractFromType(ABIType.ERC20, star).post(method, args, {event,from,value});
	}
	async proofPost({star, method, args, event,from,value}: StarArgs) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contractFromType(ABIType.PROOF, star).post(method, args, {event,from,value});
	}
	async casperPost({star, method, args, event,from,value}: StarArgs) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contractFromType(ABIType.CASPER, star).post(method, args, {event,from,value});
	}
	async starPost({star, method, args, event,from,value}: StarArgs) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contractFromType(ABIType.STAR, star).post(method, args, {event,from,value});
	}
	async minerPost({star, method, args, event,from,value}: StarArgs) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contractFromType(ABIType.MINING, star).post(method, args, {event,from,value});
	}
	async miningPost({star, method, args, event,from,value}: StarArgs) {
		await keys.checkPermission(this.userName, from);
		return await web3_c.contractFromType(ABIType.MINING, star).post(method, args, {event,from,value});
	}

	//
	review({id}: { id: string }) {
		return web3_c.review(id);
	}

	contractAddress({type,star}: {type: ABIType, star?: string}) {
		return web3_c.contractFromType(type,star).getAddress();
	}

	getBlockNumber() {
		return web3.getBlockNumber();
	}

	getNonce({account,from}: {account?: string, from?: string}) {
		return web3.getNonce(account||from);
	}

	getNonceQueue({account,from}: {account?: string, from?: string}) {
		return web3.txQueue.getNonce(account||from);
	}

	async serializedTx(tx: TxOptions) {
		await keys.checkPermission(this.userName, tx.from);
		if (!tx.nonce) {
			Object.assign(tx, await web3.txQueue.getNonce(tx.from));
		}
		var {data, hash} = await web3.signTx(tx);
		return {
			data: '0x' + data.toString('hex'),
			txid: '0x' + hash.toString('hex'),
			nonce: tx.nonce as number,
		};
	}

	async serializedTxForContract({address, method, args,from,value}: Args) {
		await keys.checkPermission(this.userName, from);
		var contract = await web3.contract(address);
		var nonce = await web3.txQueue.getNonce(from);
		var {data,hash} = await contract.methods[method](...args).signTx({value, ...nonce});
		return {
			data: '0x' + data.toString('hex'),
			txid: '0x' + hash.toString('hex'),
			nonce: nonce.nonce,
		};
	}

	async sendSignTransaction({tx}: {tx: TxOptions}) {
		await keys.checkPermission(this.userName, tx.from);
		return await web3.sendSignTransaction(tx);
	}

	async sendSignTransactionAsync({tx, callback}: {tx: TxOptions, callback?: string}) {
		await keys.checkPermission(this.userName, tx.from);
		return await web3_c.sendSignTransactionAsync(tx, e=>{
			callback && callbackURI(e, callback);
		});
	}

	sendSignedTransaction({serializedTx,opts}: {serializedTx: string, opts?: STOptions}) {
		return web3.sendSignedTransaction(buffer.from(serializedTx.slice(2), 'hex'), opts);
	}

}