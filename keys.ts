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

export interface ISecretKey {
	offset(offset: number): ISecretKey;
	hasUnlock(): boolean;
	lock(): void;
	unlock(pwd: string): void;
	exportKeystore(pwd: string): Promise<object>;
	readonly publicKey: IBuffer;
	readonly address: string;
	readonly addressBtc: string;
	sign(message: IBuffer): Promise<Signature>;
}

const default_traitKey = 'b4dd53f2fefde37c07ac4824cf7086465633e3a357daacc3adf16418275a9e51';

export class SecretKey implements ISecretKey {
	private _keystore?: object;
	private _privKeyCiphertext?: IBuffer;
	private _publicKey?: IBuffer;
	private _address?: string;
	private _addressBtc?: string;
	private _aes256key = rng(32); // random key

	static keystore(keystore: object) {
		somes.assert(keystore, 'Keystore cannot be empty');
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
		var cipher = crypto.createCipheriv('aes-256-cbc', this._aes256key, iv);
		var firstChunk = cipher.update(key);
		var secondChunk = cipher.final();
		this._privKeyCiphertext = buffer.concat([firstChunk, secondChunk]);
		return this;
	}

	private privateKey() {
		somes.assert(this._privKeyCiphertext, errno.ERR_KEY_STORE_UNLOCK);
		var cipher = crypto.createDecipheriv('aes-256-cbc', this._aes256key, iv);
		var firstChunk = cipher.update(this._privKeyCiphertext as IBuffer);
		var secondChunk = cipher.final();
		return buffer.concat([firstChunk, secondChunk]);
	}

	offset(offset: number): ISecretKey {
		var key = crypto.createHash('sha256')
			.update(this.privateKey())
			.update(default_traitKey)
			.update(String(offset * offset))
			.update(String(offset))
			.digest();
		return SecretKey.from(buffer.from(key));
	}

	derive(part_key: string): ISecretKey {
		var key = crypto.createHash('sha256')
			.update(this.privateKey())
			.update(default_traitKey)
			.update(part_key)
			.digest();
		return SecretKey.from(buffer.from(key));
	}

	hasUnlock() {
		return !!this._privKeyCiphertext;
	}

	lock() {
		if (this._privKeyCiphertext) {
			this._privKeyCiphertext.fill(0, 0, this._privKeyCiphertext.length); // Erase key
			this._privKeyCiphertext = undefined;
		}
	}

	unlock(pwd: string) {
		var key = buffer.from(keystore.decryptPrivateKey(this._keystore, pwd));
		this.setPrivKey(key);
	}

	async exportKeystore(pwd: string): Promise<object> {
		return keystore.encryptPrivateKey(Buffer.from(this.privateKey()), pwd);
	}

	get publicKey() {
		if (!this._publicKey)
			this._publicKey = crypto_tx.getPublic(this.privateKey());
		return this._publicKey as IBuffer;
	}

	get address() {
		if (!this._address)
			this._address = crypto_tx.getAddress(this.privateKey());
		return this._address as string;
	}

	get addressBtc() {
		if (!this._addressBtc)
			this._addressBtc = (btc.getAddressFromPrivateKey(
				this.privateKey(), true, false) as IBuffer).toString('base58');
		return this._addressBtc as string;
	}

	async sign(message: IBuffer): Promise<Signature> {
		var signature = crypto_tx.sign(message, this.privateKey());
		return Promise.resolve({
			signature: buffer.from(signature.signature),
			recovery: signature.recovery,
		} as Signature);
	}
}

export class KeychainManager {

	private _key_path: string = `${cfg.keys || paths.var}/keychain`;
	private _keys: Map<string, SecretKey> = new Map(); // name => key, user root key
	private _addresss_cache: Map<string, string[]> = new Map(); // name => [address]
	private _part_key_cache: Map<string, string> = new Map(); // part_key => [address]
	private _address_indexed: Map<string, [string, number, string]> = new Map(); // address => [name,offset,part_key]
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
			CREATE TABLE if not exists address_table ( -- 所有的地址列表
				address     VARCHAR (42) PRIMARY KEY NOT NULL,
				addressBtc  VARCHAR (42)             NOT NULL,
				name        VARCHAR (64)             NOT NULL, -- 用户名称
				offset      INTEGER                  NOT NULL, -- 与主key的偏移值，如果为0表示使用key生成密钥
				part_key    VARCHAR (64)                       -- 密钥相关的部分key
			);
			CREATE TABLE if not exists keys (
				address     VARCHAR (42) PRIMARY KEY NOT NULL, -- 根key地址
				name        VARCHAR (64)             NOT NULL, -- 用户名称
				size        INTEGER                  NOT NULL  -- 通过偏移方式生成的key数量
			);
		`, [
			'alter table address_table add part_key VARCHAR (64)',
		], [
			'create unique index address_indexed    on address_table (address)',
			'create unique index addressBtc_indexed on address_table (addressBtc)',
			'create unique index name_indexed       on address_table (name)',
			'create unique index part_key_indexed   on address_table (part_key)',
			'create unique index keys_indexed       on keys          (address)',
		]);
	}

	private getPart_key(name: string, part_key: string) {
		return crypto.createHash('sha256')
			.update(default_traitKey)
			.update(name + ':' + part_key)
			.digest()
			.toString('hex');
	}

	/**
	 * 
	 * 通过偏移值生成keys
	 * 
	 * @func genSecretKeys()
	 */
	async genSecretKeys(name: string, size: number) {
		somes.assert(size < 100, errno.ERR_GEN_KEYS_SIZE_LIMIT);

		if (!size) {
			return [];
		}
		var root = await this.root(name);
		var address: string[] = [];
		var keys = (await this._db.select('keys', { address: root.address }))[0];
		var start: number = keys ? keys.size: 0;

		size += start;

		somes.assert(size < 10000, errno.ERR_GEN_KEYS_SIZE_LIMIT);

		this._addresss_cache.delete(name); // clear cache

		for (var i = start; i < size; i++) {
			var key = root.offset(i + 1);
			var t = await this._db.select('address_table', { address: key.address });
			if (t.length === 0) {
				await this._db.insert('address_table', {
					address: key.address,
					addressBtc: key.addressBtc,
					name: name,
					offset: i + 1,
				});
			}
			address.push(key.address);
		}

		if (keys) {
			await this._db.update('keys', { size, name }, {address: root.address});
		} else {
			await this._db.insert('keys', { address: root.address, size, name });
		}

		return address;
	}

	/**
	 * 
	 * 通过part_key生成key
	 * 
	 * @func genSecretKeyFromPartKey()
	*/
	async genSecretKeyFromPartKey(name: string, part_key: string): Promise<string> {
		part_key = this.getPart_key(name, part_key);

		var addr = this._part_key_cache.get(part_key);
		if (addr) {
			return addr;
		}

		var address = '';
		var [data] = await this._db.select('address_table', { part_key });
		if (data) {
			address = data.address;
		} else {
			var root = await this.root(name);
			var key = root.derive(part_key);
			await this._db.insert('address_table', {
				address: key.address,
				addressBtc: key.addressBtc,
				name: name,
				offset: 0,
				part_key: part_key,
			});
			address = key.address;
		}

		// set cache
		var list = this._addresss_cache.get(name);
		if (list) {
			list.push(address);
		} else {
			this._addresss_cache.set(name, [address])
		}
		this._part_key_cache.set(part_key, address);

		return address;
	}

	async addressList(name: string) {
		if (this._addresss_cache.has(name)) {
			return this._addresss_cache.get(name) as string[];
		} else {
			var address = [] as string[];
			for (var item of await this._db.select('address_table', { name })) {
				address.push(item.address);
			}
			this._addresss_cache.set(name, address); // cache
			return address;
		}
	}

	async address(name: string, part_key?: string) { // get random address
		if (part_key) {
			return await this.genSecretKeyFromPartKey(name, part_key);
		} else {
			var addresss = await this.addressList(name);
			somes.assert(addresss.length, errno.ERR_NO_ADDRESS_IS_CREATED);
			return addresss[somes.random(0, addresss.length - 1)];
		}
	}

	async getSecretKey(addressOrAddressBtc: string) {
		var r = await this.getAddressIndexed(addressOrAddressBtc);
		return r ? await this._getSecretKeyByIndexed(r.name, r.offset): null;
	}

	async getAddressIndexed(addressOrAddressBtc: string): Promise<{
		name: string;
		offset: number;
		part_key: string;
	} | null> {
		var indexed = this._address_indexed.get(addressOrAddressBtc);
		if (indexed) {
			var [name,offset,part_key] = indexed;
			return {
				name, offset, part_key: part_key || '',
			}
		}
		var r = (await this._db.select('address_table', { address: addressOrAddressBtc }))[0];
		if (!r)
			r =   (await this._db.select('address_table', { addressBtc: addressOrAddressBtc }))[0];
		if (r) {
			this._address_indexed.set(r.address, [r.name, r.offset, r.part_key || '']);
			this._address_indexed.set(r.addressBtc, [r.name, r.offset, r.part_key || '']);
			return r as any;
		}
		return null;
	}

	private async _getSecretKeyByIndexed(name: string, offset: number, part_key?: string) {
		var root = await this.root(name);
		if (offset) {
			return { name, key: root.offset(offset) };
		} else {
			somes.assert(part_key, '_getSecretKeyByOffset(), part_ Key cannot be empty ');
			return { name, key: root.derive(part_key as string) };
		}
	}

	private async backupKeystore(name: string) {
		var path = `${this._key_path}/${name}`;
		var bin = await fs.readFile(path);
		await fs.mkdirp(`${this._key_path}/backup`); // backup keystore
		await fs.writeFile(`${this._key_path}/backup/${name}`, bin);
		await fs.mkdirp(`${this._key_path}/backup2`); // backup keystore
		await fs.writeFile(`${this._key_path}/backup2/${name}`, bin);
		await fs.mkdirp(`${this._key_path}/backup3`); // backup keystore
		await fs.writeFile(`${this._key_path}/backup3/${name}`, bin);
	}

	async setPassword(name: string, oldPwd: string, newPwd: string) {
		var key = await this.root(name);
		key.unlock(oldPwd);
		var path = `${this._key_path}/${name}`;
		var keystore = JSON.stringify(key.exportKeystore(newPwd));
		await fs.writeFile(path, keystore);
		await this.backupKeystore(name);
		key.lock();
		this._keys.delete(name);
	}

	async root(name: string) {
		var key = this._keys.get(name);
		if (!key) {
			var path = `${this._key_path}/${name}`;
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
			await this.backupKeystore(name);
			this._keys.set(name, key);
		}
		return key as SecretKey;
	}

	async checkPermission(keychainName: string, addressOrAddressBtc?: string) {
		somes.assert(addressOrAddressBtc, errno.ERR_ADDRESS_IS_EMPTY);
		var k = await this.getAddressIndexed(addressOrAddressBtc as string) as { name: string; offset: number, part_key: string };
		somes.assert(k && k.name == keychainName, errno.ERR_NO_ACCESS_KEY_PERMISSION);
		if (cfg.enable_strict_keys_permission_check) {
			await this._getSecretKeyByIndexed(k.name, k.offset, k.part_key);
		}
	}
}

export class KeysManager {
	private _keys: ISecretKey[];
	private _keychain = new KeychainManager();
	private _useSystemPermission = true;

	get useSystemPermission() { return this._useSystemPermission }
	set useSystemPermission(val) { this._useSystemPermission = val }

	get keychain() {
		return this._keychain;
	}

	constructor(keys_?: ISecretKey[]) {
		this._keys = keys_ || [];
		this._loadCfgKeys();
	}

	private _loadCfgKeys() {
		var path = `${cfg.keys || paths.var}/keys`;

		if (fs.existsSync(path)) {
			var strs = keys.parseFile(path);
			if (Array.isArray(strs)) {
				for (var priv of strs) {
					// add key
					var privKey = buffer.from(priv, 'hex');
					var address = crypto_tx.getAddress(privKey);
					if (!this._keys.find(e=>e.address == address)) {
						this._keys.push( SecretKey.from(privKey) );
					}
				}
			}
		} else {
			// throw new Error(`The private key file was not found, ${path}`);
		}
	}

	initialize() {
		return this._keychain.initialize();
	}

	private _randomIndex() {
		return somes.random(0, this._keys.length - 1);
	}

	private get _defaultKey() {
		somes.assert(this._keys[0], errno.ERR_NO_DEFAULT_SECRET_KEY);
		return this._keys[0];
	}

	get defauleAddressBtc() {
		return this._defaultKey.addressBtc;
	}

	get defauleAddress() {
		return this._defaultKey.address;
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

	async getKey(addressOrAddressBtc?: string) {
		var key: ISecretKey | undefined | null;
		var name = '__system';
		if (addressOrAddressBtc) {
			if (addressOrAddressBtc.substr(0, 2) == '0x') { // eth address
				key = this._keys.find(e=>e.address == addressOrAddressBtc);
			} else {// btc
				key = this._keys.find(e=>e.addressBtc == addressOrAddressBtc);
			}
			if (!key) {
				var k = await this.keychain.getSecretKey(addressOrAddressBtc);
				if (k) {
					name = k.name;
					key = k.key;
				}
			}
			somes.assert(key, errno.ERR_KEY_NOT_FOUND);

			return { name, key: key as SecretKey, isDefault: false }; 
		} else {
			return { name, key: this._defaultKey, isDefault: true};
		}
	}

	async checkPermission(keychainName: string, addressOrAddressBtc?: string) {
		if (this._useSystemPermission) {
			var key: ISecretKey | undefined;
			if (addressOrAddressBtc) {
				if (addressOrAddressBtc.substr(0, 2) == '0x') { // eth address
					key = this._keys.find(e=>e.address == addressOrAddressBtc);
				} else {// btc
					key = this._keys.find(e=>e.addressBtc == addressOrAddressBtc);
				}
				// can use system permission
			} else {
				key = this._defaultKey; // use default system permission
			}
		}
		await this.keychain.checkPermission(keychainName, addressOrAddressBtc);
	}

	async has(addressOrAddressBtc: string) {
		return !(await this.getKey(addressOrAddressBtc)).isDefault;
	}

	async sign(message: IBuffer, from?: string): Promise<Signature> {
		var _key = await this.getKey(from);
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
