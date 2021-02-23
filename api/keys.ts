/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-02-08
 */

import ApiController from '../api';
import keys from '../keys';

export default class extends ApiController {

	genSecretKeys({ size }: { size: number }) {
		return keys.keychain.genSecretKeys(this.userName, size);
	}

	addressList() {
		return keys.keychain.addressList(this.userName);
	}

	address() {
		return keys.keychain.address(this.userName);
	}

	async unlock({pwd}:{pwd: string}) {
		(await keys.keychain.root(this.userName)).unlock(pwd);
	}

	async lock() {
		(await keys.keychain.root(this.userName)).lock();
	}

	async signData({ data, from }: { data: any, from?: string }) {
		await keys.checkPermission(this.userName, from);
		return await keys.signData(data, from);
	}

	async signString({ data, from }: { data: string, from?: string }) {
		await keys.checkPermission(this.userName, from);
		return await keys.signString(data, from);
	}

	async signDatas({datas, from}: { datas: any[], from?: string }) {
		await keys.checkPermission(this.userName, from);
		return await keys.signDatas(datas, from);
	}

	async signMessages({ hash32Hexs, from }: { hash32Hexs: string[], from?: string }) {
		await keys.checkPermission(this.userName, from);
		return await keys.signMessages(hash32Hexs, from);
	}

	async signArgumentsFromTypes({data, types, from}: { data: any[], types: string[], from?: string }) {
		await keys.checkPermission(this.userName, from);
		return await keys.signArgumentsFromTypes(data, types, from);
	}

}