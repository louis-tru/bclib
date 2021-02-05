// SPDX-License-Identifier: (GPL-2.0+ OR MIT)
pragma solidity ^0.7.5;

import {Primitive} from './primitive.sol';

contract Organizations is Primitive {

	struct Model {
		address addr;
		string name;
		string data;
	}

	mapping(address=>Model) private _values;

	function has(address addr) public view returns (bool) {
		return _values[addr].addr != address(0);
	}

	function name(address addr) public view returns (string memory) {
		return _values[addr].name;
	}

	function data(address addr) public view returns (string memory) {
		return _values[addr].data;
	}

	function set(address addr, string memory _name, string memory _data) public payable returns(bool) {
		onlyOwner();
		Model memory m;
		m.addr = addr;
		m.name = _name;
		m.data = _data;
		_values[addr] = m;
		return true;
	}

	function del(address addr) public payable returns(bool) {
		onlyOwner();
		delete _values[addr];
		return true;
	}

}