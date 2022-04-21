/**
 * @copyright © 2022 Copyright hc
 * @date 2022-04-13
 */

import {Api, JsonRpc as JsonRpcBase, ApiInterfaces, RpcInterfaces} from 'zswjs';
import {Request, Result} from 'somes/request';
import {SignatureProvider} from 'zswjs/src/zswjs-api-interfaces';
import { RpcError } from 'zswjs/src/zswjs-rpcerror';
import buffer, {Buffer} from 'somes/buffer';
import {sm2} from 'crypto-tx';
import * as gm from 'crypto-tx/gm';
import errno from './errno';
import {KeysManager} from './keys';

type PushTransactionArgs = RpcInterfaces.PushTransactionArgs;
type SignatureProviderArgs = ApiInterfaces.SignatureProviderArgs;

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

	private _keys: Map<string, Buffer> = new Map;
	private _availableKeys: string[] = [];

	constructor(privateKeys: string[]) {
		var _keys = privateKeys.map(e=>buffer.from(e.replace(/^PVT_GM_/, ''), 'base58').slice(0, 32));
		for (const key of _keys) {
			var pub = gm.keyToString(sm2.publicKeyCreate(key), 'GM', 'PUB_GM_');
			this._keys.set(pub, key);
			this._availableKeys.push(pub);
		}
	}

	async getAvailableKeys() {
		return this._availableKeys;
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

	async sign(args: SignatureProviderArgs): Promise<PushTransactionArgs> {
		const {requiredKeys, serializedTransaction, serializedContextFreeData } = args;
		const digest = Signer.digestData(args);

		const signatures = [] as string[];
		for (const key of requiredKeys) {
			const privKey = this._keys.get(key)!;
			const pubKeyDataHex = sm2.publicKeyCreate(privKey).toString('hex');
			const sign = gm.sign(digest, privKey);
			const signature = buffer.from((pubKeyDataHex + sign + '000000000000000000000000000000000000').substring(0,105*2), 'hex');
			const signatureStr = gm.keyToString(signature, 'GM', 'SIG_GM_');
			signatures.push(signatureStr);
		}

		return { signatures, serializedTransaction, serializedContextFreeData };
	}
}

export default class ZSWApi extends Api {

	private _keys: KeysManager;

	constructor(rpc: string, keys: KeysManager) {
		super({ rpc: new JsonRpc(rpc), signatureProvider: null as any });
		this._keys = keys;
	}

}