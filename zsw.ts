/**
 * @copyright © 2022 Copyright hc
 * @date 2022-04-13
 */

import {Api, JsonRpc as JsonRpcBase, ApiInterfaces, RpcInterfaces} from 'zswjs';
import {Request, Result} from 'somes/request';
import {SignatureProvider,TransactResult} from 'zswjs/src/zswjs-api-interfaces';
import {ReadOnlyTransactResult} from 'zswjs/src/zswjs-rpc-interfaces';
import { RpcError } from 'zswjs/src/zswjs-rpcerror';
import buffer, {Buffer} from 'somes/buffer';
import {k1,sm2, publicToAddress} from 'crypto-tx';
import * as gm from 'crypto-tx/gm';
import errno from './errno';
import somes from 'somes';
import {KeysManager, KeyType} from './keys';
import cfg from './cfg';
import keys from './keys+';
import {LazyObject} from './obj';

type PushTransactionArgs = RpcInterfaces.PushTransactionArgs;
type SignatureProviderArgs = ApiInterfaces.SignatureProviderArgs;

export interface Options {
	from: string;
	timeout?: number;
}

export interface From {
	base: string;
	name: string;
}

class RpcFetch extends Request {
	parseResponseData(buf: Buffer, r: Result) {
		if (r.statusCode != 200) {
			throw Error.new(errno.ERR_HTTP_STATUS_NO_200);
		}
		var json = buf.toString('utf8');
		var res = JSON.parse(json);
		return res;
	}
}

export class JsonRpc extends JsonRpcBase {
	private _fetch: RpcFetch;

	constructor(endpoint: string) {
		super(endpoint);
		this._fetch = new RpcFetch(endpoint);
		this._fetch.urlencoded = false;
	}

	async fetch(path: string, body: any): Promise<any> {
		try {
			var {data: json} = await this._fetch.post(path, body);
			if (json.processed && json.processed.except) {
					throw new RpcError(json);
			} else if (json.result && json.result.except) {
					throw new RpcError(json);
			}
			return json;
		} catch (e: any) {
			e.isFetchError = true;
			throw e;
		}
	}
}

export class Signer implements SignatureProvider {

	private _keys: KeysManager;

	constructor(keys: KeysManager) {
		this._keys = keys;
	}

	async getAvailableKeys() {
		return [];
	}

	static digestData(args: SignatureProviderArgs) {
		const { chainId, serializedTransaction, serializedContextFreeData } = args;
		const signBuf = buffer.concat([
				buffer.from(chainId, 'hex'),
				buffer.from(serializedTransaction),
				serializedContextFreeData ?
					new Uint8Array(sm2.ec.hash().update(serializedContextFreeData).digest()) :
					new Uint8Array(32),
		]);
		var hash = sm2.ec.hash().update(signBuf).digest();
		return buffer.from(hash);
	}

	static parsePublicKey(key: string) {
		var m = key.match(/^PUB_(GM|K1)_(.+)/)!;
		somes.assert(m, errno.ERR_ZSW_PUBLIC_KEY_INVALID);
		somes.assert(m[1] == 'K1', errno.ERR_ONLY_SUPPORT_K1_PUBLIC_KEY);
		var publicKey = buffer.from(m[2], 'base58').slice(0,32);
		var address = publicToAddress(publicKey) as string;
		return {
			type: KeyType.k1,
			address,
			publicKey,
		};
	}

	async sign(args: SignatureProviderArgs): Promise<PushTransactionArgs> {
		const {requiredKeys, serializedTransaction, serializedContextFreeData } = args;
		const digest = Signer.digestData(args);

		const signatures = [] as string[];
		for (const key of requiredKeys) {
			const {type, address, publicKey} = Signer.parsePublicKey(key)!;
			const sign = await this._keys.sign(digest, address, type);
			const pubKeyDataHex = publicKey.toString('hex');
			const signature = buffer.from((pubKeyDataHex + sign + '000000000000000000000000000000000000').substring(0,105*2), 'hex');
			const suffix = type == KeyType.gm ? 'GM': 'K1';
			const signatureStr = gm.keyToString(signature, suffix, `SIG_${suffix}_`);
			signatures.push(signatureStr);
		}

		return { signatures, serializedTransaction, serializedContextFreeData };
	}
}

export class ZSWApi extends Api {

	private _keys: KeysManager;

	constructor(rpc: string, keys: KeysManager) {
		super({ rpc: new JsonRpc(rpc), signatureProvider: new Signer(keys) });
		this._keys = keys;
	}

	async publicKey(from: From) {
		const {base, name} = from;
		var key = await this._keys.keychain.getSecretKeyBy(base, 0, name);
		const pub = gm.keyToString(key.key.publicKey, 'K1', 'PUB_K1_');
		return pub;
	}

	async hasAccount(from: From) {
		const {base, name} = from;
		return await this._keys.keychain.hasPartKey(base, name);
	}

	async genAccount(from: From) {
		const {base, name} = from;
		await this._keys.keychain.genSecretKeyFromPartKey(base, name);
		const pub = await this.publicKey(from);
		// call zsw api gen account
		return pub;
	}

	async post(from: From, to: string, method: string, args?: any) {
		somes.assert(await this.hasAccount(from), errno.ERR_ZSW_FROM_ACCOUNT_NOT_EXIST);
		const requiredKeys = [await this.publicKey(from)];

		const actions = [{
			account: to,
			name: method,
			data: args || {},
			authorization: [{
				actor: from.name,
				permission: 'active',
			}],
		}];

		await this.transact({actions}, {requiredKeys, readOnlyTrx: true}) as ReadOnlyTransactResult; // try call

		const result = await this.transact({ actions }, {
			blocksBehind: 3,
			expireSeconds: 30,
			requiredKeys, readOnlyTrx: false,
		}) as TransactResult;

		return result;
	}
}

class DefaultZSWApi extends ZSWApi {
	constructor() {
		super(cfg.zsw_rpc || 'http://127.0.0.1:3031', keys.instance);
	}
}

export default new LazyObject(DefaultZSWApi);