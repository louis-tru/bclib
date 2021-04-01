/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {IWeb3Z,Web3IMPL} from './web3_impl';
import {Web3Contracts} from './web3_contract';

var _web3: IWeb3Z | undefined;
var _web3_c: Web3Contracts | undefined;

export default {

	get impl() {
		if (!_web3) {
			_web3 = new Web3IMPL();
		}
		return _web3;
	},

	set_impl(impl: IWeb3Z) {
		_web3 = impl;
	},

	get web3_c() {
		if (!_web3_c) {
			_web3_c = new Web3Contracts();
		}
		return _web3_c;
	},

	set_web3_c(web3_c: Web3Contracts) {
		_web3_c = web3_c;
	},

};