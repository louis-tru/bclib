/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-02-08
 */

import ApiController from '../api';
import keys from '../keys';

export default class extends ApiController {

	genSecretKeys({ size }: { size: number }) {
		return keys.group.genSecretKeys(this.userName, size);
	}

	addressList() {
		return keys.group.addressList(this.userName);
	}

	address() {
		return keys.group.address(this.userName);
	}

	async unlock({pwd}:{pwd: string}) {
		(await keys.group.root(this.userName)).unlock(pwd);
	}

	async lock() {
		(await keys.group.root(this.userName)).lock();
	}

	signData({ data, from }: { data: any, from?: string }) {
		return keys.signData(data, from);
	}

	signString({ data, from }: { data: string, from?: string }) {
		return keys.signString(data, from);
	}

	signDatas({datas, from}: { datas: any[], from?: string }) {
		return keys.signDatas(datas, from);
	}

	signMessages({ hash32Hexs, from }: { hash32Hexs: string[], from?: string }) {
		return keys.signMessages(hash32Hexs, from);
	}

	signArgumentsFromTypes({data, types, from}: { data: any[], types: string[], from?: string }) {
		return keys.signArgumentsFromTypes(data, types, from);
	}

}