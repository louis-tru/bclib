/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import somes from 'somes';
import keys from 'somes/keys';
import {Signature} from 'crypto-tx/sign';
import buffer, {IBuffer} from 'somes/buffer';
import * as fs from 'somes/fs2';
import cfg from './cfg';
import paths from './paths';
import errno from './errno';
import * as crypto from 'crypto';
import {DatabaseTools} from 'somes/db';
import {rng} from 'somes/rng';
import {escape} from 'somes/db';
import db from './db';
import * as crypto_tx from 'crypto-tx';
import {KeyType,Options} from 'crypto-tx/sign';
import * as crypto_tx_sign from 'crypto-tx/sign';

const btc = require('crypto-tx/btc');
const keystore = require('crypto-tx/keystore');
const iv = rng(16);

export interface ISecretKey {
	readonly publicKey: IBuffer;
	readonly address: string;
	readonly addressBtc: string;
	readonly type: KeyType;
	getPublicKey(type?: KeyType): IBuffer;
	offset(offset: number): ISecretKey;
	derive(part_key: string): ISecretKey;
	hasUnlock(): boolean;
	lock(): void;
	unlock(pwd: string): void;
	exportKeystore(pwd: string): Promise<object>;
	sign(message: IBuffer, opts?: Options): Promise<Signature>;
}

const default_traitKey = 'b4dd53f2fefde37c07ac4824cf7086465633e3a357daacc3adf16418275a9e51';

export class SecretKey implements ISecretKey {
	private _keystore?: object;
	private _privKeyCiphertext?: IBuffer;
	private _publicKey?: IBuffer;
	private _address?: string;
	private _addressBtc?: string;
	private _aes256key = rng(32); // random key
	readonly type: KeyType;

	constructor(type?: KeyType) {
		this.type = type || KeyType.K1;
	}

	static keystore(keystore: object, type?: KeyType) {
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
		var key = new SecretKey(type);
		key._keystore = keystore;
		return key;
	}

	static from(privKey: IBuffer, type?: KeyType) {
		return new SecretKey(type).setPrivKey(privKey);
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
		if (offset) {
		var key = crypto.createHash('sha256')
			.update(this.privateKey())
			.update(default_traitKey)
			.update(String(offset * offset))
			.update(String(offset))
			.digest();
			return SecretKey.from(buffer.from(key));
		} else {
			return SecretKey.from(this.privateKey());
		}
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
			if (this._keystore) {
				this._privKeyCiphertext.fill(0, 0, this._privKeyCiphertext.length); // Erase key
				this._privKeyCiphertext = undefined;
			} else {
				console.log('Cannot lock SecretKey');
			}
		}
	}

	unlock(pwd: string) {
		if (!this._privKeyCiphertext) {
			somes.assert(this._keystore, 'keystore cannot be empty');
			var key = buffer.from(keystore.decryptPrivateKey(this._keystore, pwd));
			this.setPrivKey(key);
		}
	}

	async exportKeystore(pwd: string): Promise<object> {
		return keystore.encryptPrivateKey(Buffer.from(this.privateKey()), pwd);
	}

	get publicKey() {
		if (!this._publicKey) {
			this._publicKey = this.getPublicKey(this.type);
		}
		return this._publicKey as IBuffer;
	}

	getPublicKey(type: KeyType = this.type) {
		if (type == KeyType.GM) {
			return crypto_tx.sm2.publicKeyCreate(this.privateKey());
		} else {
			return crypto_tx.getPublic(this.privateKey(), true);
		}
	}

	get address() { // k1 address
		if (!this._address)
			this._address = crypto_tx.getAddress(this.privateKey()) as string;
		return this._address as string;
	}

	get addressBtc() { // k1 btc address
		if (!this._addressBtc)
			this._addressBtc = (btc.getAddressFromPrivateKey(
				this.privateKey(), true, false) as IBuffer).toString('base58');
		return this._addressBtc as string;
	}

	async sign(message: IBuffer, opts?: Options): Promise<Signature> {
		return crypto_tx_sign.sign(message, this.privateKey(), { type: this.type, ...opts });
	}
}

export interface AccountObj {
	id: number;
	name: string;
	address: string;
	addressBtc: string;
	offset: number;
	part_key: string;
}

export class Keychain {

	private _keys: Map<string, SecretKey> = new Map(); // name => key, user root key
	private _part_key_cache: Map<string, string> = new Map(); // part_key => address
	private _address_indexed: Map<string, AccountObj> = new Map(); // address => AddressObj
	private _db = db;

	async initialize(new_db?: DatabaseTools) {
		if (new_db)
			this._db = new_db;
		else 
			this._db = db;

		await this._db.load(`
			create table if not exists keystore_list (
				id          INT PRIMARY KEY AUTO_INCREMENT,
				name        VARCHAR (64)             NOT NULL, -- 用户名称
				keystore    VARCHAR (1024)           NOT NULL,
				address     VARCHAR (42) default ('') NOT NULL, -- 根key地址
				offset_size int          default (0)  NOT NULL  -- 通过偏移方式生成的key数量
			);
			CREATE TABLE if not exists address_list ( -- 所有的地址列表
				id          INT PRIMARY KEY AUTO_INCREMENT,
				name        VARCHAR (64)             NOT NULL, -- 用户名称
				address     VARCHAR (42)             NOT NULL,
				addressBtc  VARCHAR (42)             NOT NULL,
				offset      INTEGER                  NOT NULL, -- 与主key的偏移值，如果为0表示使用key生成密钥
				part_key    VARCHAR (64)             NOT NULL  -- 密钥相关的部分key
			);
			CREATE TABLE if not exists unlock_pwd ( -- 自动 unlock keys
				name       VARCHAR (64) PRIMARY KEY NOT NULL, -- 用户名称 appid user
				pwd        VARCHAR (64)                       -- unlock pwd
			);
		`, [
			`alter table keystore_list add address  varchar (42) default ('') NOT NULL`,
			`alter table keystore_list add offset_size int default (0)  NOT NULL`,
			'alter table address_list  add part_key varchar (64) NOT NULL',
		], [
			'create unique index keystore_list_name      on keystore_list (name)',
			'create unique index keystore_list_address   on keystore_list (address)',
			'create unique index address_list_address    on address_list (address)',
			'create unique index address_list_addressBtc on address_list (addressBtc)',
			'create unique index address_list_part_key   on address_list (part_key)',
			'create        index address_list_name       on address_list (name)',
			'create        index address_list_idx1       on address_list (name,offset)',
		], 'keys');
	}

	private getPart_Key(name: string, part_key: string) {
		somes.assert(part_key, 'part_ Key cannot be empty');
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
		var root = await this.root(name, true);
		var address: string[] = [];
		var [keys] = await this._db.select('keystore_list', { name });
		var start: number = keys.offset_size;

		size += start;

		somes.assert(size < 10000, errno.ERR_GEN_KEYS_SIZE_LIMIT);

		for (var i = start; i < size; i++) {
			var key = root.offset(i + 1);
			var t = await this._db.select('address_list', { address: key.address });
			if (t.length === 0) {
				await db.insert('address_list', {
					address: key.address,
					addressBtc: key.addressBtc,
					name: name,
					offset: i + 1,
					part_key: this.getPart_Key(name, 'offset:' + i + 1)
				});
			}
			address.push(key.address);
		}

		await this._db.update('keystore_list', { offset_size: size }, {name});

		return address;
	}

	/**
	 * 
	 * 通过part_key生成key
	 * 
	 * @func genSecretKeyFromPartKey()
	*/
	async genSecretKeyFromPartKey(name: string, part_key: string): Promise<string> {
		part_key = this.getPart_Key(name, part_key);

		var addr = this._part_key_cache.get(part_key);
		if (addr) {
			return addr;
		}

		var address = '';
		var [data] = await this._db.select('address_list', { part_key });
		if (data) {
			address = data.address;
		} else {
			var root = await this.root(name, true);
			var key = root.derive(part_key);
			await this._db.insert('address_list', {
				address: key.address,
				addressBtc: key.addressBtc,
				name: name,
				offset: 0,
				part_key: part_key,
			});
			address = key.address;
		}

		// set cache
		this._part_key_cache.set(part_key, address);

		return address;
	}

	async hasPartKey(name: string, part_key: string) {
		part_key = this.getPart_Key(name, part_key);
		var data = await this._db.selectOne('address_list', { part_key });
		return !!data;
	}

	async addressList(name: string) {
		var list = await this._db.query(`select address from address_list where name=${escape(name)}`);
		return list.map(e=>e.address as string);
	}

	// private _addressCache: Map<string, string> = new Map();

	async address(name: string, part_key?: string) { // get random address
		if (part_key) {
			return await this.genSecretKeyFromPartKey(name, part_key);
		} else {
			var [key] = await this._db.select('keystore_list', {name});
			somes.assert(key && key.offset_size, errno.ERR_NO_ADDRESS_IS_CREATED);
			var offset = somes.random(1, key.offset_size);
			var addr = await this._db.selectOne('address_list', { name, offset });
			somes.assert(addr, errno.ERR_NO_ADDRESS_IS_CREATED);
			return (addr as any).address as string;
		}
	}

	async getSecretKey(addressOrAddressBtc: string) {
		var r = await this.getAddressIndexed(addressOrAddressBtc);
		if (r) {
			return await this.getSecretKeyBy_0(r.name, r.offset, r.part_key);
		}
		return null;
	}

	async getAddressIndexed(addressOrAddressBtc: string): Promise<AccountObj | null> {
		var indexed = this._address_indexed.get(addressOrAddressBtc);
		if (indexed) {
			return indexed;
		}
		var [r] = await this._db.query<AccountObj>(`
			select * from address_list
				where address=${escape(addressOrAddressBtc)}
				or addressBtc=${escape(addressOrAddressBtc)}`);
		if (r) {
			this._address_indexed.set(r.address, r);
			this._address_indexed.set(r.addressBtc, r);
			return r;
		}
		return null;
	}

	private async getSecretKeyBy_0(name: string, offset: number, part_key: string) {
		var root = await this.root(name, true);
		if (offset) {
			return { name, key: root.offset(offset) };
		} else {
			somes.assert(part_key, 'getSecretKeyBy_0(), part_key cannot be empty ');
			return { name, key: root.derive(part_key as string) };
		}
	}

	async getSecretKeyBy(name: string, offset: number, part_key: string) {
		return this.getSecretKeyBy_0(name, offset, part_key ? this.getPart_Key(name, part_key): '')
	}

	async setPassword(name: string, oldPwd: string, newPwd: string) {
		var key = await this.root(name, false);
		key.unlock(oldPwd);
		var keystore = JSON.stringify(await key.exportKeystore(newPwd));
		await this._db.update('keystore_list', {keystore}, {name});
		key.lock();
		this._keys.delete(name);
	}

	/**
	 * @func setUnlock(pwd) setting auto unlock
	 * */
	async setUnlock(name: string, pwd: string) {
		var [row] = await this._db.select('unlock_pwd', { name });
		if (row) {
			await this._db.update('unlock_pwd', { pwd }, { name });
		} else {
			await this._db.insert('unlock_pwd', { pwd, name });
		}
	}

	async unlock(name: string, pwd: string) {
		(await this.root(name)).unlock(pwd);
	}

	async lock(name: string) {
		(await this.root(name)).lock();
	}

	async root(name: string, tryUnlock?: boolean) {
		var key = this._keys.get(name);
		if (!key) {
			var [r] = await this._db.select('keystore_list', {name});
			if (!r) {
				// gen root key
				var skey = SecretKey.from(buffer.from(crypto_tx.genPrivateKey()));
				var keyobj = await skey.exportKeystore('0000');
				var keystore = JSON.stringify(keyobj); // default
				try {
					await this._db.insert('keystore_list', {name, keystore, address: skey.address});
				} catch(err: any) {
					var [r] = await this._db.select('keystore_list', {name});
					somes.assert(r, err);
					keystore = r.keystore;
				}
				key = SecretKey.keystore(JSON.parse(keystore));
			} else {
				key = SecretKey.keystore(JSON.parse(r.keystore));
			}
			this._keys.set(name, key);
		}

		if (tryUnlock && !key.hasUnlock() && cfg.keys_auto_unlock) {
			await somes.scopeLock(key, async ()=>{
				var _key = key as SecretKey;
				if (_key.hasUnlock()) return;
				var [row] = await this._db.select('unlock_pwd', { name });
				if (row && row.pwd) {
					try {
						_key.unlock(row.pwd);
					} catch(err: any) {
						console.warn('bclib/keys#root', err);
					}
				}
			});
		}

		return key as ISecretKey;
	}

	async checkPermission(keychainName: string, addressOrAddressBtc?: string) {
		somes.assert(addressOrAddressBtc, errno.ERR_ADDRESS_IS_EMPTY);
		var k = await this.getAddressIndexed(addressOrAddressBtc as string) as { name: string; offset: number, part_key: string };
		somes.assert(k && k.name == keychainName, errno.ERR_NO_ACCESS_KEY_PERMISSION);
		if (cfg.enable_strict_keys_permission_check) {
			await this.getSecretKeyBy_0(k.name, k.offset, k.part_key);
		}
	}
}

export class KeysManager {
	readonly defaultKeys: ISecretKey[];
	private _keychain = new Keychain();
	private _useSystemPermission = true;

	get useSystemPermission() { return this._useSystemPermission }
	set useSystemPermission(val) { this._useSystemPermission = val }

	get keychain() {
		return this._keychain;
	}

	constructor(keys_?: ISecretKey[]) {
		this.defaultKeys = keys_ || [];
		this._loadCfgKeys();
	}

	private _loadCfgKeys() {
		var path = `${cfg.keys || paths.var}/keys`;

		if (fs.existsSync(path)) {
			var strs = keys.parseFile(path) as string[];
			if (Array.isArray(strs)) {
				for (var priv of strs) {
					if (priv.substring(0,2) == '0x') {
						priv = priv.slice(2); // slice 0x
					}
					// add key
					var privKey = buffer.from(priv, 'hex');
					var address = crypto_tx.getAddress(privKey);
					if (!this.defaultKeys.find(e=>e.address == address)) {
						this.defaultKeys.push( SecretKey.from(privKey) );
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
		return somes.random(0, this.defaultKeys.length - 1);
	}

	private get _defaultKey() {
		somes.assert(this.defaultKeys[0], errno.ERR_NO_DEFAULT_SECRET_KEY);
		return this.defaultKeys[0];
	}

	get defauleAddressBtc() {
		return this._defaultKey.addressBtc;
	}

	get defauleAddress() {
		return this._defaultKey.address;
	}

	get publicKeys() {
		return this.defaultKeys.map(e=>e.publicKey);
	}

	get addresss() {
		return this.defaultKeys.map(e=>e.address);
	}

	get addressBtcs() {
		return this.defaultKeys.map(e=>e.addressBtc);
	}

	get publicKey() {
		return this.defaultKeys[this._randomIndex()].publicKey;
	}

	get address() {
		return this.defaultKeys[this._randomIndex()].address;
	}

	get addressBtc() {
		return this.defaultKeys[this._randomIndex()].addressBtc;
	}

	async getKey(addressOrAddressBtc?: string) {
		var key: ISecretKey | undefined | null;
		var name = '__system';
		if (addressOrAddressBtc) {
			const isEth = addressOrAddressBtc.substring(0, 2) == '0x';
			if (isEth) { // eth address
				key = this.defaultKeys.find(e=>e.address == addressOrAddressBtc);
			} else {// btc
				key = this.defaultKeys.find(e=>e.addressBtc == addressOrAddressBtc);
			}
			if (!key) {
				var k = await this.keychain.getSecretKey(addressOrAddressBtc);
				if (k) {
					name = k.name;
					key = k.key;
				}
			}
			
			somes.assert(key, errno.ERR_KEY_NOT_FOUND);
			somes.assert((isEth ? key!.address: key!.addressBtc) == addressOrAddressBtc, errno.ERR_ADDRESS_NOT_MATCH_PRIV_KEY);

			return { name, key: key as SecretKey, isDefault: false };
		} else {
			return { name, key: this._defaultKey, isDefault: true };
		}
	}

	async checkPermission(keychainName: string, addressOrAddressBtc?: string) {
		if (this._useSystemPermission) {
			var key: ISecretKey | undefined;
			if (addressOrAddressBtc) {
				if (addressOrAddressBtc.substring(0, 2) == '0x') { // eth address
					key = this.defaultKeys.find(e=>e.address == addressOrAddressBtc);
				} else {// btc
					key = this.defaultKeys.find(e=>e.addressBtc == addressOrAddressBtc);
				}
				// can use system permission
			} else {
				key = this._defaultKey; // use default system permission
			}
			if (key)
				return; // check ok
		}
		await this.keychain.checkPermission(keychainName, addressOrAddressBtc);
	}

	async has(addressOrAddressBtc: string) {
		return !(await this.getKey(addressOrAddressBtc)).isDefault;
	}

	async sign(message: IBuffer, from?: string, opts?: Options): Promise<Signature> {
		var _key = await this.getKey(from);
		var signature = await _key.key.sign(message, opts);
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
		return this.signRSV(crypto_tx_sign.message(data, types as crypto_tx_sign.Types[]), from);
	}
}
