// SPDX-License-Identifier: (GPL-2.0+ OR MIT)
pragma solidity ^0.7.5;

import {Primitive} from './primitive.sol';

contract Users is Primitive {

	struct Model {
		string name;
		string data;
	}

	mapping(address=>Model) private _values;

	function name(address addr) public view returns (string memory) {
		return _values[addr].name;
	}

	function data(address addr) public view returns (string memory) {
		return _values[addr].data;
	}

	function set(string memory _name, string memory _data) public payable returns(bool) {
		Model memory user;
		user.name = _name;
		user.data = _data;
		_values[msg.sender] = user;
		return true;
	}

}