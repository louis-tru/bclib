/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-16
 */

import ApiController from '../api';
import {TxOptions,STOptions} from 'web3z';
import web3 from '../web3';
import web3_c from '../web3_contract';
import {ABIType} from '../abi';
import buffer from 'somes/buffer';

interface Args_ {
	method: string;
	args?: any[];
	event?: string;
	from?: string;
}

interface Args extends Args_ {
	address: string;
}

interface StarArgs extends Args_ {
	star?: string;
}

export default class extends ApiController {

	// contract call
	contractGet({address, method, args}: Args) { return web3_c.contract(address).get(method, args) }
	contractPost({address, method, args,event,from}: Args) { return web3_c.contract(address).post(method, args,{event,from}) }
	contractPostSync({address, method, args, event,from}: Args) { return web3_c.contract(address).postSync(method, args, {event,from}) }

	// get
	bankGet({star, method, args}: StarArgs) { return web3_c.contractFromType(ABIType.BANK, star).get(method, args) }
	erc20Get({star, method, args}: StarArgs) { return web3_c.contractFromType(ABIType.ERC20, star).get(method, args) }
	erc721Get({star, method, args}: StarArgs) { return web3_c.contractFromType(ABIType.ERC721, star).get(method, args) }
	proofGet({star, method, args}: StarArgs) { return web3_c.contractFromType(ABIType.PROOF, star).get(method, args) }
	casperGet({star, method, args}: StarArgs) { return web3_c.contractFromType(ABIType.CASPER, star).get(method, args) }
	starGet({star, method, args}: StarArgs) { return web3_c.contractFromType(ABIType.STAR, star).get(method, args) }
	minerGet({star, method, args}: StarArgs) { return web3_c.contractFromType(ABIType.MINER, star).get(method, args) }
	miningGet({star, method, args}: StarArgs) { return web3_c.contractFromType(ABIType.MINING, star).get(method, args) }
	
	// post
	bankPost({star, method, args, event,from}: StarArgs) { return web3_c.contractFromType(ABIType.BANK, star).post(method, args, {event,from}) }
	erc20Post({star, method, args, event,from}: StarArgs) { return web3_c.contractFromType(ABIType.ERC20, star).post(method, args, {event,from}) }
	erc721Post({ star, method, args, event,from}: StarArgs) { return web3_c.contractFromType(ABIType.ERC20, star).post(method, args, {event,from}) }
	proofPost({star, method, args, event,from}: StarArgs) { return web3_c.contractFromType(ABIType.PROOF, star).post(method, args, {event,from}) }
	casperPost({star, method, args, event,from}: StarArgs) { return web3_c.contractFromType(ABIType.CASPER, star).post(method, args, {event,from}) }
	starPost({star, method, args, event,from}: StarArgs) { return web3_c.contractFromType(ABIType.STAR, star).post(method, args, {event,from}) }
	minerPost({star, method, args, event,from}: StarArgs) { return web3_c.contractFromType(ABIType.MINING, star).post(method, args, {event,from}) }
	miningPost({star, method, args, event,from}: StarArgs) { return web3_c.contractFromType(ABIType.MINING, star).post(method, args, {event,from}) }

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

	async serializedTx({tx}: { tx: TxOptions }) {
		if (!tx.nonce) {
			Object.assign(tx, await web3.txQueue.getNonce());
		}
		var {data, hash} = await web3.signTx(tx);
		return {
			data: '0x' + data.toString('hex'),
			txid: '0x' + hash.toString('hex'),
			nonce: tx.nonce,
		};
	}

	async serializedTxForContract({address, method, args,from}: Args) {
		var contract = await web3.contract(address);
		var nonce = await web3.txQueue.getNonce(from);
		var {data,hash} = await contract.methods[method](...args).signTx(nonce);
		return {
			data: '0x' + data.toString('hex'),
			txid: '0x' + hash.toString('hex'),
			nonce: nonce.nonce,
		};
	}

	sendSignTransaction({tx}: {tx: TxOptions}) {
		return web3.sendSignTransaction(tx);
	}

	sendSignedTransaction({serializedTx,opts}: {serializedTx: string, opts?: STOptions}) {
		return web3.sendSignedTransaction(buffer.from(serializedTx.slice(2), 'hex'), opts);
	}

}