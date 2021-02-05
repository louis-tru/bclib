// SPDX-License-Identifier: (GPL-2.0+ OR MIT)
pragma solidity ^0.7.5;

import {Primitive} from './primitive.sol';

/**
 * 日志数据
 */
contract Logs is Primitive {

	struct Signer {
		address addr;
		uint256 timestamp;
	}

	// 日志列表
	mapping(bytes32=>Signer) private _values;
	// 定义事件
	event onLog(bytes32 hash, address indexed addr, uint256 timestamp);

	/**
	 * 检查日志
	 */
	function get(bytes32 hash) public view returns (address,uint256) {
		Signer storage signer = _values[hash];
		return (signer.addr, signer.timestamp );
	}

	/**
	 * 安全添加数据日志，同时通过签名获取签名者，用这个签名者来验证数据
	 */
	function setHash(bytes32 hash, bytes32 sigR, bytes32 sigS, uint8 sigV) public payable returns (address, uint256) {
		checkRunning();
		require(_values[hash].timestamp == 0);
		// bytes32 data = keccak256(bytes);
		address addr = ecrecover(hash, sigV, sigR, sigS);
		// uint256 hash = uint256(data);
		Signer memory signer;
		signer.addr = addr;
		signer.timestamp = block.timestamp;
		_values[hash] = signer;
		emit onLog(hash, addr, block.timestamp); // 发射事件
		return (addr, block.timestamp);
	}

}