/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-16
 */

import ApiController from './api';
import {TxOptions,STOptions} from 'web3z';
import web3 from './web3';
import web3_api from './web3_contract';
import {ABIType} from './abi';
import buffer from 'somes/buffer';

interface Args_ {
	method: string;
	args?: any[];
	event?: string;
}

interface Args0 extends Args_ {
	address: string;
}

interface Args extends Args_ {
	star?: string;
	method: string;
	args?: any[];
	event?: string;
}

export default class extends ApiController {

	// contract call
	contractGet({address, method, args}: Args0) { return web3_api.contract(address).get(method, args) }
	contractPost({address, method, args,event}: Args0) { return web3_api.contract(address).post(method, args,event) }
	contractPostSync({address, method, args, event}: Args0) { return web3_api.contract(address).postSync(method, args, event) }

	// get
	starGet({star, method, args}: Args) { return web3_api.star(star).get(method, args) }
	erc20Get({star, method, args}: Args) { return web3_api.erc20(star).get(method, args) }
	bankGet({star, method, args}: Args) { return web3_api.bank(star).get(method, args) }
	minerGet({star, method, args}: Args) { return web3_api.miner(star).get(method, args) }
	miningGet({star, method, args}: Args) { return web3_api.mining(star).get(method, args) }
	erc721Get({star, method, args}: Args) { return web3_api.erc721(star).get(method, args) }

	// post
	starPost({star, method, args, event}: Args) { return web3_api.star(star).post(method, args, event) }
	erc20Post({star, method, args, event}: Args) { return web3_api.erc20(star).post(method, args, event) }
	bankPost({star, method, args, event}: Args) { return web3_api.bank(star).post(method, args, event) }
	minerPost({star, method, args, event}: Args) { return web3_api.miner(star).post(method, args, event) }
	miningPost({star, method, args, event}: Args) { return web3_api.mining(star).post(method, args, event) }
	erc721Post({ star, method, args, event}: Args) { return web3_api.erc721(star).post(method, args, event) }

	//
	review({id}: { id: string }) {
		return web3_api.review(id);
	}

	contractAddress({type,star}: {type: ABIType, star?: string}) {
		return web3_api.starContract(type,star).getAddress();
	}

	getBlockNumber() {
		return web3.getBlockNumber();
	}

	getNonce({account}: {account: string}) {
		return web3.getNonce(account);
	}

	getNonceQueue({account}: {account: string}) {
		return web3.txQueue.getNonce(account);
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

	async serializedTxForContract({address, method, args}: Args0) {
		var contract = await web3.contract(address);
		var nonce = await web3.txQueue.getNonce();
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