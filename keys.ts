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
import {User} from './users';
import * as crypto from 'crypto';

const crypto_tx = require('crypto-tx');
const btc = require('crypto-tx/btc');
const keystore = require('crypto-tx/keystore');

export class SecretKey {
	private _keystore?: object;
	private _privKey?: IBuffer;
	private _publicKey?: IBuffer;
	private _address?: string;
	private _addressBtc?: string;

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
		var key = new SecretKey();
		key._privKey = privKey;
		return key;
	}

	offset(offset: number): SecretKey {
		somes.assert(offset < 1000, errno.ERR_GEN_KEYS_SIZE_LIMIT);
		var priv = Buffer.from(this.privKey);
		var hash = crypto.createHash('sha256');
		for (var i = 0; i < offset; i++) {
			priv = hash.update(priv).digest();
		}
		return SecretKey.from(buffer.from(priv));
	}

	private get privKey() {
		somes.assert(this._privKey, errno.ERR_KEY_STORE_UNLOCK);
		return this._privKey as IBuffer;
	}

	hasUnlock() {
		return !!this._privKey;
	}

	unlock() {
		if (this._privKey) {
			this._privKey.write(buffer.alloc(32), 0); // Erase key
			this._privKey = undefined;
		}
	}

	lock(pwd: string) {
		this._privKey = buffer.from(keystore.decryptPrivateKey(this._keystore, pwd));
	}

	exportKeystore(pwd: string): object {
		return keystore.encryptPrivateKey(this.privKey, pwd);
	}

	get publicKey() {
		if (!this._publicKey)
			this._publicKey = crypto_tx.getPublic(this.privKey);
		return this._publicKey as IBuffer;
	}

	get address() {
		if (!this._address)
			this._address = crypto_tx.getAddress(this.privKey);
		return this._address as string;
	}

	get addressBtc() {
		if (!this._addressBtc)
			this._addressBtc = (btc.getAddressFromPrivateKey(this.privKey, true, false) as IBuffer).toString('base58');
		return this._addressBtc as string;
	}

	async sign(message: IBuffer): Promise<Signature> {
		var signature = crypto_tx.sign(message, this.privKey);
		return Promise.resolve({
			signature: buffer.from(signature.signature),
			recovery: signature.recovery,
		} as Signature);
	}
}

class Keys {
	private _keys: SecretKey[] = [];

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

	private _key(addressOrAddressBtc?: string) {
		var def = this._keys[0];
		var key: typeof def | undefined;
		if (addressOrAddressBtc) {
			if (addressOrAddressBtc.substr(0, 2) == '0x') { // eth address
				key = this._keys.find(e=>e.address == addressOrAddressBtc);
			} else {// btc
				key = this._keys.find(e=>e.addressBtc == addressOrAddressBtc);
			}
		}
		return key ? {key: key, ok: true}: {key: def, ok: false};
	}

	has(addressOrAddressBtc: string) {
		return this._key(addressOrAddressBtc).ok;
	}

	async sign(message: IBuffer, addressOrAddressBtc?: string): Promise<Signature> {
		var signature = await this._key(addressOrAddressBtc).key.sign(message);
		return {
			signature: buffer.from(signature.signature),
			recovery: signature.recovery,
		};
	}
}

class UserKeys {

	private _keyPath: string = `${cfg.keys || paths.var}/user_keys`;
	private _keys: Map<string, SecretKey> = new Map();
	private _address_offsets: Map<string, Map<string, number>> = new Map();

	constructor() {
		somes.assert(fs.statSync(this._keyPath).isDirectory(), 'This is not a user key directory');
	}

	async genSecretKeys(user: User, size: number) {
		somes.assert(size < 1000, errno.ERR_GEN_KEYS_SIZE_LIMIT);
		var key = await this.root(user);
		var address: string[] = [];

		for (var i = 0; i < size; i++) {
			key = key.offset(1);
			address.push(key.address);
			await fs.writeFile(`${this._keyPath}/${user.name}/${key.address}`, String(i));
		}
		return address;
	}

	async addresss(user: User) {
		var dir = `${this._keyPath}/${user.name}`;
		var address = [] as string[];
		if (await fs.exists(dir)) {
			for (var i of await fs.readdir(dir)) {
				if (i != 'root') {
					if (crypto_tx.checkAddressHex(i)) {
						address.push(i);
					}
				}
			}
		}
		return address;
	}

	async getSecretKey(user: User, address: string): Promise<SecretKey | null> {
		var offset = 0;

		var a = this._address_offsets.get(user.name);
		if (a) {
			offset = a.get(address) || 0;
			if (offset) {
				return await this.getSecretKeyByOffset(user, offset);
			}
		}

		var path = `${this._keyPath}/${user.name}/${address}`;
		if (await fs.exists(path)) {
			var n = await fs.readFile(path);
			offset = Number(n.toString()) || 0;
		}

		if (!offset) {
			return null;
		}

		if (!a)
			this._address_offsets.set(user.name, a = new Map());
		a.set(address, offset); // set cache

		return await this.getSecretKeyByOffset(user, offset);
	}

	async getSecretKeyByOffset(user: User, offset: number) {
		var root = await this.root(user);
		return root.offset(offset);
	}

	async root(user: User) {
		var key = this._keys.get(user.name);
		if (!key) {
			var dir = `${this._keyPath}/${user.name}`;
			await fs.mkdirp(dir);
			if (!await fs.exists(`${dir}/root`)) {
				// gen root key
				var privkey = buffer.from(crypto_tx.genPrivateKey());
				key = SecretKey.from(privkey);
				var keystore = JSON.stringify(key.exportKeystore('0000'), null, 2); // default 
				await fs.writeFile(`${dir}/root`, keystore);
			} else {
				var keystore_s = await fs.readFile(`${dir}/root`);//buffer.from(await fs.readFile(`${dir}/root`));
				key = SecretKey.keystore(JSON.parse(keystore_s.toString()));
			}
			this._keys.set(user.name, key);
		}
		return key as SecretKey;
	}

}

export default new Keys();
export var user_keys = new UserKeys();