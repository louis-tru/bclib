/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import somes from 'somes';
import keys from 'somes/keys';
import {Signature} from 'web3z';
import buffer, {IBuffer} from 'somes/buffer';
import * as fs from 'somes/fs';
import * as cfg from '../config';
import paths from './paths';

const crypto_tx = require('crypto-tx');
const btc = require('crypto-tx/btc');

class Accounts {
	private _accounts: ({privKey: IBuffer, publicKey: IBuffer, addressBtc: string, address: string})[];

	constructor() {
		this._accounts = [];

		var pravkeyPath = cfg.privateKey || `${paths.var}/privateKey`;
		if (fs.existsSync(pravkeyPath)) {
			var strs = keys.parseFile(pravkeyPath);
			for (var priv of strs) {
				this.setPrivateKey('0x' + priv);
			}
		} else {
			throw new Error(`The private key file was not found, ${pravkeyPath}`);
		}
	}

	private setPrivateKey(privateKey: string) {
		var privKey = buffer.from(crypto_tx.toBuffer(privateKey));
		var address = crypto_tx.getAddress(privKey);
		var addressBtc = (btc.address(privKey, true, false) as IBuffer).toString('base58');
		if (this._accounts.find(e=>e.address == address)) {
			return;
		}
		var publicKey = buffer.from(crypto_tx.getPublic(privKey));
		this._accounts.push({ privKey, publicKey, address, addressBtc });
	}

	private get _randomIndex() {
		return somes.random(0, this._accounts.length - 1);
	}

	get publicKeys() {
		return this._accounts.map(e=>e.publicKey);
	}
	get addresss() {
		return this._accounts.map(e=>e.address);
	}
	get addressBtcs() {
		return this._accounts.map(e=>e.addressBtc);
	}
	get publicKey() {
		return this._accounts[this._randomIndex].publicKey;
	}
	get address() {
		return this._accounts[this._randomIndex].address;
	}
	get addressBtc() {
		return this._accounts[this._randomIndex].addressBtc;
	}
	private _key(addressOrAddressBtc?: string) {
		var def = this._accounts[0];
		var key: typeof def | undefined;
		if (addressOrAddressBtc) {
			if (addressOrAddressBtc.substr(0, 2) == '0x') { // eth address
				key = this._accounts.find(e=>e.address == addressOrAddressBtc);
			} else {// btc
				key = this._accounts.find(e=>e.addressBtc == addressOrAddressBtc);
			}
		}
		return key ? {key: key.privKey, ok: true}: {key: def.privKey, ok: false};
	}
	has(addressOrAddressBtc: string) {
		return this._key(addressOrAddressBtc).ok;
	}
	async sign(message: IBuffer, addressOrAddressBtc?: string): Promise<Signature> {
		var signature = crypto_tx.sign(message, this._key(addressOrAddressBtc).key);
		return {
			signature: buffer.from(signature.signature),
			recovery: signature.recovery,
		} as Signature;
	}
}

export default new Accounts();