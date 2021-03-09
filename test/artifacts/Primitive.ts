/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-08
 */

import {TransactionReceipt} from 'web3z';
import {Result} from 'web3z/happy';
import {Address} from '../../solidity_types';

export * from '../../solidity_types';

export interface Primitive {
	owner(): Result<Address>;
	isRunning(): Result<boolean>; // 合约是否被作废
	destroy(): Result<TransactionReceipt>;
	setOwner(address: Address): Result<TransactionReceipt>;
}
