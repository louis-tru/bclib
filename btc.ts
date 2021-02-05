/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {btc} from './request';
import accounts from './accounts';
import * as bitcoin from 'bitcoinjs-lib';
import {Transaction} from 'bitcoinjs-lib';
import TxBuild from './btc_tx';
import buffer from 'somes/buffer';

class SignerIMPL implements bitcoin.SignerAsync {
	publicKey: Buffer;
	constructor(publicKey: Buffer) {
		this.publicKey = publicKey;
	}
	async sign(message: Buffer) {
		var signature = await accounts.sign(buffer.from(message));
		return Buffer.from(signature.signature);
	}
}

export async function balance() {
	var r = await btc.get(`address/${accounts.addressBtc}`);
	return r.data.balance;
}

export async function transfer(address: string, amount: number) {
	var {data: {average}} = await btc.get(`txs/fee`, null, {cacheTime: 1e6/*1000s*/});

	var {data: {hex}} = await btc.post(`txs/create`, {
		inputs: [{ address: accounts.addressBtc, value: amount }],
		outputs: [{ address: address, value: amount }],
		fee:  { address : accounts.addressBtc, value: average },
		// data: `dphotos-${device.serialNumber}`,
		replaceable: true,
	});

	var publicKey = Buffer.from(accounts.publicKey);
	var network = bitcoin.networks.bitcoin;
	var tx = Transaction.fromHex(hex);
	var txb = TxBuild.fromTransaction(tx, network);

	for (var i = 0; i < tx.ins.length; i++) {
		await txb.signAsync(i, new SignerIMPL(publicKey));
	}

	var raw = txb.build().toHex();
	var {data: { txid, view_in_explorer }} = await btc.post(`txs/send`, { hex: raw });

	// "txid": "085080fe1000d0b3bd9362b4e05eaa7594e57a660428d49271ef9159c285e239",
	// "view_in_explorer": "https://blockexplorer.one/btc/testnet/tx/085080fe1000d0b3bd9362b4e05eaa7594e57a660428d49271ef9159c285e239?utm_source=cryptoapis.io"

	return {
		txid: txid as string,
		view_in_explorer: view_in_explorer as string,
	};
}

export async function unconfirmed() {
	// address/mtz44F24cdUHA44ntwcfNs7mfFdKzZKYAb/unconfirmed-transactions?index=0&limit=50
	var {data} = await btc.get(`address/${accounts.addressBtc}/unconfirmed-transactions`, { index: 0, limit: 50 });
	return data;
}