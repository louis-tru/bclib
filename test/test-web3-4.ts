/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import web3z from '../web3+';
// import {Transaction} from 'web3z';
import { AbiInput } from 'web3-utils';

var kun_abi = [{
	"constant": true,
	"inputs": [{
		"name": "",
		"type": "address"
	}],
	"name": "opsForCentralBank",
	"outputs": [{
		"name": "",
		"type": "uint8"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x5822c5ae"
}, {
	"constant": true,
	"inputs": [{
		"name": "",
		"type": "address"
	}],
	"name": "opsForKunOperatorPool",
	"outputs": [{
		"name": "",
		"type": "uint8"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x6f31b5cf"
}, {
	"constant": true,
	"inputs": [{
		"name": "",
		"type": "address"
	}],
	"name": "opsForOperatorPool",
	"outputs": [{
		"name": "",
		"type": "uint8"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x8d2b4dbc"
}, {
	"constant": true,
	"inputs": [],
	"name": "owner",
	"outputs": [{
		"name": "",
		"type": "address"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x8da5cb5b"
}, {
	"constant": true,
	"inputs": [{
		"name": "",
		"type": "address"
	}],
	"name": "opsForRewardPool",
	"outputs": [{
		"name": "",
		"type": "uint8"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0xb90b60a4"
}, {
	"constant": true,
	"inputs": [{
		"name": "",
		"type": "address"
	}],
	"name": "opsForDeviceStatus",
	"outputs": [{
		"name": "",
		"type": "uint8"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0xfc04942e"
}, {
	"inputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "constructor",
	"signature": "constructor"
}, {
	"payable": true,
	"stateMutability": "payable",
	"type": "fallback"
}, {
	"constant": false,
	"inputs": [{
		"name": "newOwner",
		"type": "address"
	}],
	"name": "changeOwner",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0xa6f9dae1"
}, {
	"constant": false,
	"inputs": [{
		"name": "_oper",
		"type": "address"
	}],
	"name": "setOperator",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0xb3ab15fb"
}, {
	"constant": false,
	"inputs": [{
		"name": "_oper1",
		"type": "address"
	}, {
		"name": "_oper2",
		"type": "address"
	}],
	"name": "setOperator2",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0xccc83f22"
}, {
	"constant": false,
	"inputs": [{
		"name": "_operators",
		"type": "address[]"
	}],
	"name": "setOperators",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0xddf71cd5"
}, {
	"constant": false,
	"inputs": [{
		"name": "_oper1",
		"type": "address"
	}, {
		"name": "_oper2",
		"type": "address"
	}, {
		"name": "_oper3",
		"type": "address"
	}, {
		"name": "_oper4",
		"type": "address"
	}, {
		"name": "_oper5",
		"type": "address"
	}],
	"name": "setOperator5",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0x95d88e6d"
}, {
	"constant": false,
	"inputs": [{
		"name": "_oper1",
		"type": "address"
	}, {
		"name": "_oper2",
		"type": "address"
	}, {
		"name": "_oper3",
		"type": "address"
	}, {
		"name": "_oper4",
		"type": "address"
	}, {
		"name": "_oper5",
		"type": "address"
	}, {
		"name": "_oper6",
		"type": "address"
	}, {
		"name": "_oper7",
		"type": "address"
	}, {
		"name": "_oper8",
		"type": "address"
	}, {
		"name": "_oper9",
		"type": "address"
	}, {
		"name": "_oper10",
		"type": "address"
	}],
	"name": "setOperator10",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0x3d26a60d"
}, {
	"constant": false,
	"inputs": [{
		"name": "_digital_proof",
		"type": "address"
	}, {
		"name": "_creator",
		"type": "address"
	}, {
		"name": "_proofHash",
		"type": "bytes32"
	}, {
		"name": "_metaData",
		"type": "bytes"
	}],
	"name": "submitProof",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0xb778d2ac"
}, {
	"constant": false,
	"inputs": [{
		"name": "_erc20",
		"type": "address"
	}, {
		"name": "_account",
		"type": "address"
	}, {
		"name": "_amount",
		"type": "uint256"
	}],
	"name": "mint",
	"outputs": [{
		"name": "",
		"type": "bool"
	}],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0xc6c3bbe6"
}];

var proof_abi = [{
	"constant": true,
	"inputs": [{
		"name": "",
		"type": "address"
	}],
	"name": "operators",
	"outputs": [{
		"name": "",
		"type": "uint256"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x13e7c9d8"
}, {
	"constant": true,
	"inputs": [{
		"name": "",
		"type": "bytes32"
	}],
	"name": "proofData",
	"outputs": [{
		"name": "",
		"type": "bytes"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x1e01e9d6"
}, {
	"constant": true,
	"inputs": [],
	"name": "owner",
	"outputs": [{
		"name": "",
		"type": "address"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x8da5cb5b"
}, {
	"constant": true,
	"inputs": [{
		"name": "",
		"type": "bytes32"
	}],
	"name": "proofExist",
	"outputs": [{
		"name": "",
		"type": "uint256"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0xf63b35d0"
}, {
	"inputs": [{
		"name": "kun",
		"type": "address"
	}],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "constructor",
	"signature": "constructor"
}, {
	"anonymous": false,
	"inputs": [{
		"indexed": true,
		"name": "newOwner",
		"type": "address"
	}],
	"name": "ContractOwnerChange",
	"type": "event",
	"signature": "0x244d7373b30235fa9edbfb82721cab961fea5671e5ac8ca5837760a6f2a289c0"
}, {
	"anonymous": false,
	"inputs": [{
		"indexed": true,
		"name": "identity",
		"type": "address"
	}, {
		"indexed": false,
		"name": "newOwner",
		"type": "address"
	}],
	"name": "DIDOwnerChanged",
	"type": "event",
	"signature": "0x9071b3f486383ebd5972712e0a90e1012d2f68a61306af305f8bdc974debde87"
}, {
	"anonymous": false,
	"inputs": [{
		"indexed": true,
		"name": "identity",
		"type": "address"
	}, {
		"indexed": false,
		"name": "proofHash",
		"type": "bytes32"
	}, {
		"indexed": false,
		"name": "data",
		"type": "bytes"
	}],
	"name": "NewProofEvent",
	"type": "event",
	"signature": "0xc0cc87e87873dc20b8856029a4e543977cd624b654e66880ce41c30d4c0a9f47"
}, {
	"constant": false,
	"inputs": [{
		"name": "newOwner",
		"type": "address"
	}],
	"name": "changeOwner",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0xa6f9dae1"
}, {
	"constant": true,
	"inputs": [],
	"name": "getContractOwner",
	"outputs": [{
		"name": "",
		"type": "address"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x442890d5"
}, {
	"constant": false,
	"inputs": [{
		"name": "operator",
		"type": "address"
	}, {
		"name": "value",
		"type": "uint256"
	}],
	"name": "setOperator",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0x77754136"
}, {
	"constant": true,
	"inputs": [{
		"name": "operator",
		"type": "address"
	}],
	"name": "getOperator",
	"outputs": [{
		"name": "",
		"type": "uint256"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x5865c60c"
}, {
	"constant": false,
	"inputs": [{
		"name": "_creator",
		"type": "address"
	}, {
		"name": "_proofHash",
		"type": "bytes32"
	}, {
		"name": "_metaData",
		"type": "bytes"
	}],
	"name": "submitProof",
	"outputs": [],
	"payable": false,
	"stateMutability": "nonpayable",
	"type": "function",
	"signature": "0x73ca666c"
}, {
	"constant": true,
	"inputs": [{
		"name": "_proofHash",
		"type": "bytes32"
	}],
	"name": "getProof",
	"outputs": [{
		"name": "",
		"type": "bytes"
	}],
	"payable": false,
	"stateMutability": "view",
	"type": "function",
	"signature": "0x1b80bb3a"
}];

export default async function() {

	// debugger;

	var web3 = ()=>web3z.impl.web3;

	var log = web3().eth.abi.decodeLog([
		{name: 'identity',  type: "address", "indexed": true },
		{name: 'proofHash', type: "bytes32", "indexed": false},
		{name: 'data',      type: "bytes", "indexed": false },
	], 
	'0x5696baa29a79c17d1fc45245336f8eb4a03bcf713b76ea86706aebd1b4b7e0b6000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000031236780000000000000000000000000000000000000000000000000000000000',
	[
		// "0xc0cc87e87873dc20b8856029a4e543977cd624b654e66880ce41c30d4c0a9f47",
		"0x000000000000000000000000b1dcdcace002e3a441f254985684afe1d3f4d307"
	]);

	var kun = web3z.impl.createContract('0xd3886dFFB57b4EA654827bC8eE43eA7f3B49Fdf5', kun_abi as any);
	var proof = web3z.impl.createContract('0xB1dcdcaCe002e3a441f254985684AfE1D3F4D307', proof_abi as any);

	// submitProof(address _digital_proof, address _creator, bytes32 _proofHash, bytes _metaData)

	// var tx = await web3z.enqueue(e=>kun.methods.submitProof(
	// 		'0xB1dcdcaCe002e3a441f254985684AfE1D3F4D307',
	// 		'0xB1dcdcaCe002e3a441f254985684AfE1D3F4D307',
	// 		'0x5696baa29a79c17d1fc45245336f8eb4a03bcf713b76ea86706aebd1b4b7e0b6',
	// 		'0x123678'
	// 	).sendSignTransaction(e)
	// , { from: '0x5aAF6973BbB77bF8f149E1ae9768fBb1EC867650'});

	// var tx = (await web3.eth.getTransaction('0x90b10b2a98f63be1784675803cde9c4d81cbaa29a15bbbaa2c88e5313c2ac540')) as Transaction;
	// var tx = { blockNumber: 494439, transactionHash: '0x90b10b2a98f63be1784675803cde9c4d81cbaa29a15bbbaa2c88e5313c2ac540' };
	var tx = { blockNumber: 495269, transactionHash: '0x613be86e349b4af077abe0f15cf9165f56841898e9f88dcd90fe00a16d6fca04' };
	
	// console.log(tx);

	var block = await web3().eth.getBlock(tx.blockNumber);
	var transactionReceipts = [];
	var transactions = [];
	for (var i of block.transactions) {
		transactionReceipts.push(await web3().eth.getTransactionReceipt(i));
		transactions.push(await web3().eth.getTransaction(i));
	}

	// find events
	// event NewProofEvent(address indexed identity, bytes32 proofHash, bytes data);

	var evt = await proof.findEvent('NewProofEvent', tx.transactionHash, tx.blockNumber);

	return {
		transactionReceipts,
		transactions,
		tx,
		evt,
		log,
	};

};