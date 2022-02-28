/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2020-07-16
 */

import APIController from '../api';
import {STOptions} from 'web3z';
import web3 from '../web3+';
import {TxOptions} from '../web3_tx';
import buffer from 'somes/buffer';
import keys from '../keys+';

interface Args {
	chain: number;
	address: string;
	from: string;
	method: string;
	args?: any[];
	value?: string;
	timeout?: number; // timeout
	retry?: number;
	callback?: string;
	blockRange?: number;
}

export default class extends APIController {

	async serializedTx({chain, tx}:{chain: number, tx: TxOptions}) {
		await keys.impl.checkPermission(this.userName, tx.from);
		if (!tx.nonce)
			tx.nonce = await web3[chain].getNonce(tx.from);
		var {data, hash} = await web3[chain].signTx(tx);
		return {
			data: '0x' + data.toString('hex'),
			txid: '0x' + hash.toString('hex'),
			nonce: tx.nonce,
		};
	}

	async serializedTxForContract({chain, address, method, args, from, value, nonce }: Args & {nonce?: number}) {
		await keys.impl.checkPermission(this.userName, from);
		var contract = await web3[chain].contract(address);
		if (!nonce)
			nonce = await web3[chain].getNonce(from);
		var {data,hash} = await contract.methods[method](...args).signTx({value, nonce});
		return {
			data: '0x' + data.toString('hex'),
			txid: '0x' + hash.toString('hex'),
			nonce: nonce,
		};
	}

	// -----

	review({id}: { id: string }) {
		for (var i in web3)
			return web3[i].tx.review(id);
		throw Error.new('web3 not implemented');
	}

	get({chain,address, method, args}: Args) {
		return web3[chain].tx.get(address, method, args);
	}

	// async tx

	async post({chain,address, method, args,callback,...opts}: Args) {
		await keys.impl.checkPermission(this.userName, opts.from);
		return await web3[chain].tx.post(address, method, args, opts, callback);
	}

	async sendTx({chain,tx, callback}: {chain: number, tx: TxOptions, callback?: string}) {
		await keys.impl.checkPermission(this.userName, tx.from);
		return await web3[chain].tx.sendTx(tx, callback);
	}

	// sync tx, no enqueue

	async postSync({chain, address, method, args, ...opts}: Args & {nonce?: number}) {
		await keys.impl.checkPermission(this.userName, opts.from);
		var c = await web3[chain].contract(address);
		var fn = c.methods[method as string](...(args||[]));
		await fn.call(opts); // try call
		return await fn.post(opts);
	}

	async sendSignTransactionSync({chain,tx}: {chain: number,tx: TxOptions}) {
		await keys.impl.checkPermission(this.userName, tx.from);
		return await web3[chain].sendSignTransaction(tx);
	}

	sendSignedTransactionSync({chain,serializedTx,opts}: {chain: number,serializedTx: string, opts?: STOptions}) {
		return web3[chain].sendSignedTransaction(buffer.from(serializedTx.slice(2), 'hex'), opts);
	}

}