/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import web3z from '../src/web3';
import {TransactionReceipt} from 'web3z';
import accounts_lib from '../src/accounts';
import solidity from '../src/contracts';

export default async function({ num, tx }:{ num: number, tx?:number }) {
	var blockNumber = Number(num) || 1863;
	var web3 = web3z.raw;
	var [address, address1] = accounts_lib.addresss;

	var tx1: TransactionReceipt | null = null;

	// tx1 = await web3z.enqueue(e=>web3z.sendTransaction({
	// 	...e,
	// 	value: '0x00',
	// 	data: abi.bytecode
	// }), { from });

	var license_types = solidity.license_types.happy(address);
	var users = solidity.users.happy(address);
	var logs = solidity.logs.happy(address);

	var set_send: any = {
		set_send: {
			blockHash: "0x292f1f4ca3800dddabfc0579abd25c718713a5b041749684480d14bc204336ff",
			blockNumber: 16631,
			contractAddress: null,
			cumulativeGasUsed: 344162,
			from: "0x4ebfacfe3bf91c3cd7674e999134f83d86aff315",
			gasUsed: 344162,
			logs: [
				{
					address: "0xC655AFE774B260956a53E3A0e1140d7b9E977a50",
					blockHash: "0x292f1f4ca3800dddabfc0579abd25c718713a5b041749684480d14bc204336ff",
					blockNumber: 16631,
					data: "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000000000000000000000000021e6b894e4b89ae888b9e888b6e68ab5e68abce69d83e799bbe8aeb0e8af81e4b9a600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001531313130303030303030303031393731334430353700000000000000000000000000000000000000000000000000000000000000000000000000000000000024e4b8ade58d8ee4babae6b091e585b1e5928ce59bbde4baa4e9809ae8bf90e8be93e983a800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001231313130303030303030303031393731334400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000015e6b395e4babae5928ce585b6e4bb96e7bb84e7bb8700000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000009e4b88ae6b5b7e5b88200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009e7a68fe5bbbae79c8100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009e5b9bfe4b89ce79c8100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009e6b599e6b19fe79c810000000000000000000000000000000000000000000000",
					logIndex: 0,
					removed: false,
					topics: [
						"0x88100c0a03e6b485e627f87b07dc0e9c35579dda72332fb7ea126ff85b1893df"
					],
					transactionHash: "0xb47e093b286d263f686bde449a1b895db9b39d48ddf7ab5dd625fdea43001cfe",
					transactionIndex: 0,
					transactionLogIndex: "0x0",
					type: "mined",
					id: "log_bffa8b93"
				}
			],
			logsBloom: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000010000000000000000001000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
			root: "0xf62f9d18919830fca5416438a8edcffc7dd32d2406fba975ac0d0472ace3c32e",
			to: "0xc655afe774b260956a53e3a0e1140d7b9e977a50",
			transactionHash: "0xb47e093b286d263f686bde449a1b895db9b39d48ddf7ab5dd625fdea43001cfe",
			transactionIndex: 0
		}
	};

	// set_send = await license_types.set(
	// 	'11100000000019713D057', "渔业船舶抵押权登记证书", "中华人民共和国交通运输部", '11100000000019713D', "法人和其他组织", [
	// 		'上海市', '福建省', '广东省', '浙江省'
	// 	]
	// );
	// set_send = await license_types.set(
	// 	'11100000000019713D006', "中华人民共和国水路运输许可证", "中华人民共和国交通运输部", '11100000000019713D', "法人和其他组织", [
	// 		'辽宁省','安徽省','福建省','重庆市','贵州省','宁夏回族自治区','新疆生产建设兵团','浙江省'
	// 	]
	// );

	var get1 = await license_types.get('11100000000019713D057');
	var get2 = await license_types.get('11100000000019713D006');

	return {
		tx1,set_send,get1,get2,
	};

};