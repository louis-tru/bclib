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
import {KeyType} from 'crypto-tx/sign';
import * as account from 'crypto-tx/account';
import {sm2, publicToAddress} from 'crypto-tx';
import errno from './errno';
import somes from 'somes';
import {KeysManager} from './keys';
import cfg from './cfg';
import keys from './keys+';
import {LazyObject} from './obj';

type PushTransactionArgs = RpcInterfaces.PushTransactionArgs;
type SignatureProviderArgs = ApiInterfaces.SignatureProviderArgs;

export interface Action {
	account: string,
	name: string,
	data?: any,
	from?: string,
	authorization?: {
		actor: string,
		permission: string,
	}[],
}

class RpcFetch extends Request {
	parseResponseData(buf: Buffer, r: Result) {
		var json = buf.toString('utf8');
		var res = JSON.parse(json);
		if (r.statusCode != 200) {
			throw Error.new(errno.ERR_HTTP_STATUS_NO_200).ext({...res.error, message: res.error.what, name: 'Error'});
		}
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
		return [] as string[];
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

	async rawSign(digest: Buffer, key: string, publicKey: Buffer, type: KeyType) {
		somes.assert(type == KeyType.K1, errno.ERR_ONLY_SUPPORT_K1_PUBLIC_KEY);
		var address = publicToAddress(publicKey) as string; // k1
		const sign = await this._keys.sign(digest, address, type);
		return sign;
	}

	async sign(args: SignatureProviderArgs): Promise<PushTransactionArgs> {
		const {requiredKeys, serializedTransaction, serializedContextFreeData } = args;
		const digest = Signer.digestData(args);

		const signatures = [] as string[];
		for (const key of requiredKeys) {
			const {type, pub} = account.zsw_parseKey(key);
			const sign = await this.rawSign(digest, key, pub, type);
			const pubKeyDataHex = pub.toString('hex');
			let signStr = '';
			if (type === KeyType.K1) { // k1
				let zswchainRecoveryParam = sign.recovery + 27;
				if (sign.recovery <= 3) {
					zswchainRecoveryParam += 4;
				}
				signStr = buffer.concat([[zswchainRecoveryParam], sign.signature]).toString('hex');
			} else { // gm
				signStr = sign.signature.toString('hex');
			}
			const signature = buffer.from((pubKeyDataHex + signStr + '000000000000000000000000000000000000').substring(0,105*2), 'hex');
			const signatureStr = account.zsw_keyToString(signature, type, 'SIG_{0}_'); // SIG_GM_signature
			signatures.push(signatureStr);
		}

		return { signatures, serializedTransaction, serializedContextFreeData };
	}
}

export class ZSWApi extends Api {

	readonly keys: KeysManager;

	constructor(rpc: string, keys: KeysManager, signer?: Signer) {
		super({ rpc: new JsonRpc(rpc), signatureProvider: signer || new Signer(keys) });
		this.keys = keys;
	}

	async getPublicKey(base: string, name: string) {
		var key = await this.keys.keychain.getSecretKeyBy(base, 0, name);
		const pub = account.zsw_keyToString(key.key.publicKey, KeyType.K1, 'PUB_{0}_');
		return pub;
	}

	async hasAccount(base: string, name: string) {
		return await this.keys.keychain.hasPartKey(base, name);
	}

	async genAccount(base: string, name: string) {
		await this.keys.keychain.genSecretKeyFromPartKey(base, name);
		const pubKey = await this.getPublicKey(base, name);
		// call zsw api gen account
		return {name, pubKey};
	}

	async post(acts: Action[], base: string) {
		const froms = new Set<string>();
		const requiredKeys = [] as string[];
		const actions = [] as any[];

		for (let act of acts) {
			let authorization = act.authorization || [{actor: act.from!, permission: 'active'}];
			for (let auth of authorization) {
				somes.assert(await this.hasAccount(base, auth.actor), errno.ERR_ZSW_FROM_ACCOUNT_NOT_EXIST);
				if (!froms.has(auth.actor)) {
					froms.add(auth.actor);
					requiredKeys.push(await this.getPublicKey(base, auth.actor));
				}
			}
			actions.push({
				account: act.account,
				name: act.name,
				data: act.data || {},
				authorization: authorization,
			});
		}

		//await this.transact({actions}, {requiredKeys, readOnlyTrx: true}) as ReadOnlyTransactResult; // try readOnly call

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

export default new LazyObject<ZSWApi>(DefaultZSWApi);