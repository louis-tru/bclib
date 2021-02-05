/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from 'somes';
import {Console as ConsoleBase} from 'somes/log';
import paths from './paths';
import cfg from './cfg';

class Console extends ConsoleBase {

	constructor(path: string) {
		super(path);

		utils.onUncaughtException.on((e)=>{
			this.error(e.data);
		});

		utils.onUnhandledRejection.on((e)=>{
			this.error(e.data.reason);
		});
	}

	async initialize() {
		// ..
	}

}

export default new Console(`${paths.var}/${cfg.name}.log`).makeDefault();