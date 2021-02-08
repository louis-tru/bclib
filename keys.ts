/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import somes from 'somes';
import keys from 'somes/keys';
import {Signature} from 'web3z';
import buffer, {IBuffer} from 'somes/buffer';
import * as fs from 'somes/fs2';
import cfg from './cfg';
import paths from './paths';
import errno from './errno';
import * as crypto from 'crypto';
import {SQLiteTools} from './sqlite';
import {rng} from 'somes/rng';

const crypto_tx = require('crypto-tx');
const crypto_tx_sign = require('crypto-tx/sign');
const btc = require('crypto-tx/btc');
const keystore = require('crypto-tx/keystore');
const iv = rng(16);

export class SecretKey {
	private _keystore?: object;
	private _privKeyCiphertext?: IBuffer;
	private _publicKey?: IBuffer;
	private _address?: string;
	private _addressBtc?: string;
	private _offsets: SecretKey[] = []; // keys caches
	private _aes256key = rng(32); // random key

	static keystore(keystore: object) {
		/*
			{
				"id":"bf663519-ed4c-e602-6fe8-8cbf86f4513b",
				"version":3,
				"crypto":{
					"cipher":"aes-128-ctr",
					"cipherparams":{"iv":"51e7ac9e436811fcc76b1f5cea207012"},
					"ciphertext":"5091b11ce4a95d61eae81ecf66e01812fd15ea5ff7129a3993abbb1a60b06b3c",
					"kdf":"pbkdf2",
					"kdfparams":{"c":10240,"dklen":32,"prf":"hmac-sha256","salt":"172ab48ce6bad2d99d87656509020e9b08e9cfaa8936408a36c370862bec236a"},
					"mac":"770d6e50cadd479d515694b30433dc4c54da2db7c34e24c9285bf7e227cc9cae"
				},
				"address":"4ebfacfe3bf91c3cd7674e999134f83d86aff315",
				"name":"",
				"meta":"{}"
			}
		*/
		var key = new SecretKey();
		key._keystore = keystore;
		return key;
	}

	static from(privKey: IBuffer) {
		return new SecretKey().setPrivKey(privKey);
	}

	private setPrivKey(key: IBuffer) {
		var cipher = crypto.createCipheriv("aes-256-cbc", this._aes256key, iv);
		var firstChunk = cipher.update(key);
		var secondChunk = cipher.final();
		this._privKeyCiphertext = buffer.concat([firstChunk, secondChunk]);
		return this;
	}

	private getPrivKey() {
		somes.assert(this._privKeyCiphertext, errno.ERR_KEY_STORE_UNLOCK);
		var cipher = crypto.createDecipheriv("aes-256-cbc", this._aes256key, iv);
		var firstChunk = cipher.update(this._privKeyCiphertext as IBuffer);
		var secondChunk = cipher.final();
		return buffer.concat([firstChunk, secondChunk]);
	}

	offset(offset: number): SecretKey {
		somes.assert(offset > 0, errno.ERR_GEN_KEYS_SIZE_LIMIT);
		somes.assert(offset < 100, errno.ERR_GEN_KEYS_SIZE_LIMIT);
		var hash = crypto.createHash('sha256');
		var priv = Buffer.from(this.getPrivKey());

		if (this._offsets[offset - 1]) {
			return this._offsets[offset - 1];
		}

		for (var i = 0; i < offset; i++) {
			if (!this._offsets[i]) {
				priv = hash.update(priv).update('b4dd53f2fefde37c07ac4824cf7086465633e3a357daacc3adf16418275a9e51').digest();
				this._offsets[i] = SecretKey.from(buffer.from(priv));
			} else {
				priv = Buffer.from(this._offsets[i].getPrivKey());
			}
		}
		return this._offsets[offset - 1];
	}

	hasUnlock() {
		return !!this._privKeyCiphertext;
	}

	lock() {
		if (this._privKeyCiphertext) {
			this._privKeyCiphertext.fill(0, 0, this._privKeyCiphertext.length); // Erase key
			this._privKeyCiphertext = undefined;
			for (var i of this._offsets) {
				i.lock();
			}
			this._offsets = [];
		}
	}

	unlock(pwd: string) {
		var key = buffer.from(keystore.decryptPrivateKey(this._keystore, pwd));
		this.setPrivKey(key);
	}

	exportKeystore(pwd: string): object {
		return keystore.encryptPrivateKey(this.getPrivKey(), pwd);
	}

	get publicKey() {
		if (!this._publicKey)
			this._publicKey = crypto_tx.getPublic(this.getPrivKey());
		return this._publicKey as IBuffer;
	}

	get address() {
		if (!this._address)
			this._address = crypto_tx.getAddress(this.getPrivKey());
		return this._address as string;
	}

	get addressBtc() {
		if (!this._addressBtc)
			this._addressBtc = (btc.getAddressFromPrivateKey(this.getPrivKey(), true, false) as IBuffer).toString('base58');
		return this._addressBtc as string;
	}

	async sign(message: IBuffer): Promise<Signature> {
		var signature = crypto_tx.sign(message, this.getPrivKey());
		return Promise.resolve({
			signature: buffer.from(signature.signature),
			recovery: signature.recovery,
		} as Signature);
	}
}

export class KeystoreGroup {

	private _key_path: string = `${cfg.keys || paths.var}/keys_group`;
	private _keys: Map<string, SecretKey> = new Map(); // group => key
	private _address_indexed: Map<string, [string, number]> = new Map(); // address => [group,offset]
	private _addresss: Map<string, string[]> = new Map(); // group => [address]
	private _db: SQLiteTools;

	constructor(path?: string) {
		if (path)
			this._key_path = path;
		fs.mkdirpSync(this._key_path)
		// somes.assert(fs.statSync(this._key_path).isDirectory(), 'This is not a user key directory');
		this._db = new SQLiteTools(`${this._key_path}/address_indexed.db`);
	}

	initialize() {
		return this._db.initialize(`
			CREATE TABLE if not exists address_table (
				address     VARCHAR (42) PRIMARY KEY NOT NULL,
				addressBtc  VARCHAR (42)             NOT NULL,
				group       VARCHAR (64)             NOT NULL
				offset      INTEGER                  NOT NULL
			);
			CREATE TABLE if not exists keys (
				address     VARCHAR (42) PRIMARY KEY NOT NULL,
				group       VARCHAR (64)             NOT NULL,
				size        INTEGER                  NOT NULL
			);
		`, [], [
			'create unique index address_indexed    on address_table (address)',
			'create unique index addressBtc_indexed on address_table (addressBtc)',
			'create unique index keys_indexed       on keys          (address)',
		]);
	}

	async genSecretKeys(group: string, size: number) {
		somes.assert(size < 100, errno.ERR_GEN_KEYS_SIZE_LIMIT);
		var key = await this.root(group);
		var address: string[] = [];
		var keys = (await this._db.select('keys', { address: key.address }))[0];
		var start: number = keys ? keys.size: 0;

		for (var i = start; i < size; i++) {
			var _key = key.offset(i + 1);
			if ((await this._db.select('address_table', { address: _key.address })).length === 0) {
				await this._db.insert('address_table', { address: _key.address, addressBtc: _key.addressBtc, group, offset: i + 1 });
			}
			address.push(_key.address);
		}

		if (keys) {
			await this._db.update('keys', { address: key.address, size, group });
		} else {
			await this._db.insert('keys', { address: key.address, size, group });
		}

		return address;
	}

	async addressList(group: string) {
		if (this._addresss.has(group)) {
			return this._addresss.get(group) as string[];
		} else {
			var address = [] as string[];
			for (var item of await this._db.select('address_table', { group })) {
				address.push(item.address);
			}
			this._addresss.set(group, address);
			return address;
		}
	}

	async address(group: string) { // get random address
		var addresss = await this.addressList(group);
		somes.assert(addresss.length, errno.ERR_NO_ADDRESS_IS_CREATED);
		return addresss[somes.random(0, addresss.length - 1)];
	}

	async getSecretKey(addressOrAddressBtc: string): Promise<SecretKey | null> {
		var indexed = this._address_indexed.get(addressOrAddressBtc);
		if (indexed) {
			var [group,offset] = indexed;
			return await this.getSecretKeyByOffset(group, offset);
		}
		var r = (await this._db.select('address_table', { address: addressOrAddressBtc }))[0];
		if (!r)
			r =   (await this._db.select('address_table', { addressBtc: addressOrAddressBtc }))[0];
		if (r) {
			var key = await this.getSecretKeyByOffset(r.group, r.offset);
			this._address_indexed.set(r.address, [r.group, r.offset]);
			this._address_indexed.set(r.addressBtc, [r.group, r.offset]);
			return key;
		}
		return null;
	}

	async getSecretKeyByOffset(group: string, offset: number) {
		var root = await this.root(group);
		return root.offset(offset);
	}

	private async backupKeystore(group: string) {
		var path = `${this._key_path}/${group}`;
		var bin = fs.readFile(path);
		await fs.mkdirp(`${this._key_path}/backup`); // backup keystore
		await fs.writeFile(`${this._key_path}/backup/${group}`, bin);
		await fs.mkdirp(`${this._key_path}/backup2`); // backup keystore
		await fs.writeFile(`${this._key_path}/backup2/${group}`, bin);
		await fs.mkdirp(`${this._key_path}/backup3`); // backup keystore
		await fs.writeFile(`${this._key_path}/backup3/${group}`, bin);
	}

	async setKeystorePassword(group: string, oldPwd: string, newPwd: string) {
		var key = await this.root(group);
		key.unlock(oldPwd);
		var path = `${this._key_path}/${group}`;
		var keystore = JSON.stringify(key.exportKeystore(newPwd));
		await fs.writeFile(path, keystore);
		await this.backupKeystore(group);
		key.lock();
		this._keys.delete(group);
	}

	async root(group: string) {
		var key = this._keys.get(group);
		if (!key) {
			var path = `${this._key_path}/${group}`;
			if (!await fs.exists(path)) {
				// gen root key
				var privkey = buffer.from(crypto_tx.genPrivateKey());
				key = SecretKey.from(privkey);
				var keystore = JSON.stringify(key.exportKeystore('0000'), null, 2); // default
				await fs.writeFile(path, keystore);
			} else {
				var keystore_bin = await fs.readFile(path);
				key = SecretKey.keystore(JSON.parse(keystore_bin.toString()));
			}
			await this.backupKeystore(group);
			this._keys.set(group, key);
		}
		return key as SecretKey;
	}

}

export class KeysManager {
	private _keys: SecretKey[] = [];
	private _group = new KeystoreGroup();

	get group() {
		return this._group;
	}

	constructor() {
		var path = `${cfg.keys || paths.var}/keys`;

		if (fs.existsSync(path)) {
			var strs = keys.parseFile(path);
			for (var priv of strs) {
				// add key
				var privKey = buffer.from(crypto_tx.toBuffer(priv));
				var address = crypto_tx.getAddress(privKey);
				if (!this._keys.find(e=>e.address == address)) {
					this._keys.push( SecretKey.from(privKey) );
				}
			}
		} else {
			throw new Error(`The private key file was not found, ${path}`);
		}
	}

	initialize() {
		return this._group.initialize();
	}

	private _randomIndex() {
		return somes.random(0, this._keys.length - 1);
	}

	get defauleAddressBtc() {
		return this._keys[0].addressBtc;
	}

	get defauleAddress() {
		return this._keys[0].address;
	}

	get publicKeys() {
		return this._keys.map(e=>e.publicKey);
	}

	get addresss() {
		return this._keys.map(e=>e.address);
	}

	get addressBtcs() {
		return this._keys.map(e=>e.addressBtc);
	}

	get publicKey() {
		return this._keys[this._randomIndex()].publicKey;
	}

	get address() {
		return this._keys[this._randomIndex()].address;
	}

	get addressBtc() {
		return this._keys[this._randomIndex()].addressBtc;
	}

	private async _key(addressOrAddressBtc?: string) {
		var def = this._keys[0];
		var key: typeof def | undefined | null;
		if (addressOrAddressBtc) {
			if (addressOrAddressBtc.substr(0, 2) == '0x') { // eth address
				key = this._keys.find(e=>e.address == addressOrAddressBtc);
			} else {// btc
				key = this._keys.find(e=>e.addressBtc == addressOrAddressBtc);
			}
			if (!key) {
				key = await this.group.getSecretKey(addressOrAddressBtc);
			}
		}
		return key ? {key: key, ok: true}: {key: def, ok: false};
	}

	async has(addressOrAddressBtc: string) {
		return (await this._key(addressOrAddressBtc)).ok;
	}

	async sign(message: IBuffer, from?: string): Promise<Signature> {
		var _key = await this._key(from);
		somes.assert(_key.key, errno.ERR_DEFAULT_KEY_NOT_FOUND);
		var signature = await _key.key.sign(message);
		return {
			signature: buffer.from(signature.signature),
			recovery: signature.recovery,
		};
	}

	async signRSV(message: IBuffer, from?: string): Promise<{ r: string, s: string, v: number }> {
		var {signature,recovery} = await this.sign(message, from);
		return {
			r: '0x' + signature.slice(0, 32).toString('hex'),
			s: '0x' + signature.slice(32, 64).toString('hex'),
			v: recovery,
		};
	}

	signData(data: any, from?: string) {
		return this.signString(JSON.stringify(data), from);
	}

	signString(data: string, from?: string) {
		var msg = crypto_tx.keccak(data).data;
		return this.signRSV(buffer.from(msg), from);
	}

	async signDatas(datas: any[], from?: string) {
		var r = [] as { r: string, s: string, v: number }[];
		for (var data of datas) {
			r.push(await this.signData(data, from));
		}
		return r;
	}

	async signMessages(hash32Hexs: string[], from?: string) {
		var r = [] as { r: string, s: string, v: number }[];
		for (var hex of hash32Hexs) {
			r.push(await this.signData(buffer.from(hex.slice(2), 'hex'), from));
		}
		return r;
	}

	signArgumentsFromTypes(data: any[], types: string[], from?: string) {
		return this.signRSV(crypto_tx_sign.message(data, types), from);
	}
}

export default new KeysManager();