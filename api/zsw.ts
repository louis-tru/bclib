/**
 * @copyright © 2022 Copyright hc
 * @date 2022-04-21
 */

import APIController from '../api';
import zsw, {Action} from '../zsw';

export default class extends APIController {
	
	getPublicKey({account}: {account:string}) {
		return zsw.impl.getPublicKey(this.name, account);
	}

	hasAccount({account}: {account:string}) {
		return zsw.impl.hasAccount(this.name, account);
	}

	genAccount({account}: {account:string}) {
		return zsw.impl.genAccount(this.name, account);
	}

	post({actions}: { actions: Action[] }) {
		return zsw.impl.post(actions, this.name);
	}
}