/**
 * @copyright © 2022 Copyright hc
 * @date 2022-04-13
 */

import fetch from 'node-fetch';
import {Api, JsonRpc, ApiInterfaces, RpcInterfaces} from 'zswjs';
import {JsSignatureProvider} from 'zswjs/dist/zswjs-jssig';
import {KeysManager} from './keys';

type PushTransactionArgs = RpcInterfaces.PushTransactionArgs;
type SignatureProviderArgs = ApiInterfaces.SignatureProviderArgs;

async function test() {
	const rpcURL = 'http://127.0.0.1:3031';
	const privateKeys = ['PVT_GM_2AThMitUvftLxZvyX4GE8WHqrMftihuKQT7wcmHduMJCkNjgFB'];
	const actions = [
		{
			"account": "zswhq",
			"name": "newaccount",
			"data": {
				"creator": "zsw.admin",
				"name": "chuxuewenlou",
				"owner": {
					"threshold": 1,
					"keys": [
						{
							"key": "PUB_GM_7XYxTKU4fC1h7mtrgMG8wsQzMS5SBoAkXcJ2gZM7kF476CuXCr",
							"weight": 1
						}
					],
					"accounts": [],
					"waits": []
				},
				"active": {
					"threshold": 1,
					"keys": [
						{
							"key": "PUB_GM_5jzZrffbUkNWrGrutUPk2xwk3xS56xbSq2kSeGZobwMCLdxnQt",
							"weight": 1
						}
					],
					"accounts": [],
					"waits": []
				}
			},
			"authorization": [
				{
					"actor": "zsw.admin",
					"permission": "active"
				}
			],
		},
		{
			"account": "zswhq",
			"name": "buyrambytes",
			"data": {
				"payer": "zsw.admin",
				"receiver": "chuxuewenlou",
				"bytes": 1000000
			},
			"authorization": [
				{
					"actor": "zsw.admin",
					"permission": "active"
				}
			]
		},
		{
			"account": "zswhq",
			"name": "delegatebw",
			"data": {
				"from": "zsw.admin",
				"receiver": "chuxuewenlou",
				"stake_net_quantity": "100.0000 ZSWCC",
				"stake_cpu_quantity": "10000.0000 ZSWCC",
				"transfer": true
			},
			"authorization": [
				{
					"actor": "zsw.admin",
					"permission": "active"
				}
			]
		},
		{
			"account": "zsw.perms",
			"name": "setperms",
			"data": {
				"sender": "zsw.admin",
				"scope": "zsw.prmcore",
				"user": "chuxuewenlou",
				"perm_bits": 524271
			},
			"authorization": [
				{
					"actor": "zsw.admin",
					"permission": "active"
				}
			]
		},
		{
			"account": "zswhq.token",
			"name": "transfer",
			"data": {
				"from": "zsw.admin",
				"to": "chuxuewenlou",
				"quantity": "10000.0000 ZSWCC",
				"memo": ""
			},
			"authorization": [
				{
					"actor": "zsw.admin",
					"permission": "active"
				}
			]
		}
	];
	const rpc = new JsonRpc(rpcURL, { fetch });
	const signatureProvider = new JsSignatureProvider(privateKeys);
	const api = new Api({ rpc, signatureProvider});
	const result = await api.transact(
		{ actions },
		{
			blocksBehind: 3,
			expireSeconds: 30,
		}
	);

	return result;
}

export default class ZSWApi extends Api implements ApiInterfaces.SignatureProvider {

	private _keys: KeysManager;

	constructor(rpc: string, keys: KeysManager) {
		super({ rpc: new JsonRpc(rpc, { fetch }), signatureProvider: null as any });
		this._keys = keys;
		this.signatureProvider = this;
	}

	async getAvailableKeys(): Promise<string[]> {
		return [];
	}

	async sign(args: SignatureProviderArgs): Promise<PushTransactionArgs> {
		// keys.impl.sign(message, from);
		throw '';
	}

}