/**
 * @copyright © 2022 Copyright hc
 * @date 2022-04-13
 */

import fetch from 'node-fetch'; //你需要安装：npm install --save node-fetch@2 zswjs
import {Api, JsonRpc} from 'zswjs'; //你需要安装：npm install --save node-fetch@2 zswjs
import {JsSignatureProvider} from 'zswjs/dist/zswjs-jssig';

async function runTransaction() {
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
			]
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

runTransaction().then((r)=>{
	console.log("RESULT:\n"+JSON.stringify(r, null, 2));
	process.exit(0);
}).catch((error)=>{
	console.error("ERROR: \n",error);
	process.exit(1);
});