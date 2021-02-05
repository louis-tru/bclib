// SPDX-License-Identifier: (GPL-2.0+ OR MIT)
pragma solidity ^0.7.5;

/*
block.blockhash(uint blockNumber) returns (bytes32): hash of the given block - only works for 256 most recent, excluding current, blocks - deprecated in version 0.4.22 and replaced by blockhash(uint blockNumber).
block.coinbase (address): current block miner’s address
block.difficulty (uint): current block difficulty
block.gaslimit (uint): current block gaslimit
block.number (uint): current block number
block.timestamp (uint): current block timestamp as seconds since unix epoch
gasleft() returns (uint256): remaining gas
msg.data (bytes): complete calldata
msg.gas (uint): remaining gas - deprecated in version 0.4.21 and to be replaced by gasleft()
msg.sender (address): sender of the message (current call)
msg.sig (bytes4): first four bytes of the calldata (i.e. function identifier)
msg.value (uint): number of wei sent with the message
now (uint): current block timestamp (alias for block.timestamp)
tx.gasprice (uint): gas price of the transaction
tx.origin (address): sender of the transaction (full call chain)
*/

contract Primitive {
	address public owner;
	bool public isRunning; // 合约是否被作废

	constructor() payable {
		owner = msg.sender;
		isRunning = true;
	}

	/**
	 * 检查合约是否运行
	 */
	function checkRunning() internal view {
		require(isRunning == true);
	}

	/**
	 * 仅允许合约拥有者调用
	 */
	function onlyOwner() internal view {
		checkRunning();
		require(msg.sender == owner);
	}

	/**
	 * 销毁合约
	 */
	function destroy() public payable returns(bool) {
		onlyOwner();
		isRunning = false;
		return true;
	}

	/**
	 * 变更合约owner
	 */
	function setOwner(address newOwner) public payable returns(bool) {
		onlyOwner();
		require(newOwner != address(0));
		owner = newOwner;
		return true;
	}

}