/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-02-08
 */

import ApiController from '../api';
import keys from '../keys+';

export default class extends ApiController {

	genSecretKeys({ size }: { size: number }) {
		return keys.impl.keychain.genSecretKeys(this.userName, size);
	}

	genSecretKeyFromPartKey({ part_key }: { part_key: string }) {
		return keys.impl.keychain.genSecretKeyFromPartKey(this.userName, part_key);
	}

	addressList() {
		return keys.impl.keychain.addressList(this.userName);
	}

	address({part_key, chain}:{part_key?: string, chain?: number}) {
		return keys.impl.keychain.address(this.userName, part_key);
	}

	async unlock({pwd}:{pwd: string}) {
		(await keys.impl.keychain.root(this.userName)).unlock(pwd);
	}

	async lock() {
		(await keys.impl.keychain.root(this.userName)).lock();
	}

	setPassword({oldPwd, newPwd}: {oldPwd: string, newPwd: string}) {
		return keys.impl.keychain.setPassword(this.userName, oldPwd, newPwd);
	}

	setUnlock({pwd}: {pwd: string}) {
		return keys.impl.keychain.setUnlock(this.userName, pwd);
	}

	async keychainKeystore({pwd}: {pwd: string}) {
		return (await keys.impl.keychain.root(this.userName)).exportKeystore(pwd);
	}

	async signData({ data, from }: { data: any, from?: string }) {
		await keys.impl.checkPermission(this.userName, from);
		return await keys.impl.signData(data, from);
	}

	async signString({ data, from }: { data: string, from?: string }) {
		await keys.impl.checkPermission(this.userName, from);
		return await keys.impl.signString(data, from);
	}

	async signDatas({datas, from}: { datas: any[], from?: string }) {
		await keys.impl.checkPermission(this.userName, from);
		return await keys.impl.signDatas(datas, from);
	}

	async signMessages({ hash32Hexs, from }: { hash32Hexs: string[], from?: string }) {
		await keys.impl.checkPermission(this.userName, from);
		return await keys.impl.signMessages(hash32Hexs, from);
	}

	async signArgumentsFromTypes({data, types, from}: { data: any[], types: string[], from?: string }) {
		await keys.impl.checkPermission(this.userName, from);
		return await keys.impl.signArgumentsFromTypes(data, types, from);
	}

}