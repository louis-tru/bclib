/**
 * @copyright © 2022 Copyright hc
 * @date 2022-04-21
 */

import APIController from '../api';
import zsw from '../zsw';

export default class extends APIController {
	
	publicKey({account}: {account:string}) {
		return zsw.impl.publicKey({base: this.name, name: account});
	}

	hasAccount({account}: {account:string}) {
		return zsw.impl.hasAccount({base: this.name, name: account});
	}

	genAccount({account}: {account:string}) {
		return zsw.impl.genAccount({base: this.name, name: account});
	}

	post({from, to, method, args}: {from: string, to: string, method: string, args?: any}) {
		return zsw.impl.post({base: this.name, name: from}, to, method, args);
	}
}