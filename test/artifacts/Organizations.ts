/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-08
 */

import {Result} from 'web3z/happy';
import {Primitive, Address, Bytes32} from './Primitive';
import * as json from './Organizations.json';

export const abi = json.abi;
export const contractName = json.contractName;
export const contractAddress = '0xFb2Aa32Eaf818d91a22dBFF331e1f5F4804732f6';
export const owner = '0xD6188Da7d84515ad4327cd29dCA8Adc1B1DABAa3';
export const defaultOrganization = '0xD6188Da7d84515ad4327cd29dCA8Adc1B1DABAa3';

export default interface Organizations extends Primitive {
	has(address: Address): Result<boolean>;
	name(address: Address): Result<string>;
	data(address: Address): Result<string>;
	set(address: Address, name: string, bytes: Bytes32): Result<void>;
	del(address: Address): Result<void>;
}