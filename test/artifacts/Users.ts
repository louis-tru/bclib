/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-08
 */

import {Result} from 'web3z/happy';
import {Primitive, Address, Bytes32} from './Primitive';
import * as json from './Users.json';

export const abi = json.abi;
export const contractName = json.contractName;
export const contractAddress = '0xad9546798944502760E36f99C58230eA4972d076';

export default interface Users extends Primitive {
	name(address: Address): Result<string>;
	data(address: Address): Result<string>;
	set(name: string, bytes: Bytes32): Result<void>;
}