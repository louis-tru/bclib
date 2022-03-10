/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import somes from 'somes';
import {Console as ConsoleBase} from 'somes/log';
import paths from './paths';
import cfg from './cfg';
import { exec } from 'somes/syscall';
import { workers } from './env';

export class UncaughtException extends ConsoleBase {

	private _abortOnUncaughtException = false;

	constructor(path?: string) {
		super(
			path || (workers ? `${paths.var}/${cfg.name}_${workers.id}.log`: `${paths.var}/${cfg.name}.log`)
		);
		somes.onUncaughtException.on((e)=>this._Err(e.data));
		somes.onUnhandledRejection.on((e)=>this._Err(e.data.reason));
	}

	private _Err(err: any) {
		this.error(err);
		this.reportException(cfg.name, err);
		if (this._abortOnUncaughtException) {
			somes.exit(err.errno || 0);
		}
	}

	async watch(logPaht: string, tty: number) {
		while(true) {
			try {
				await exec(`tail -f ${logPaht} > /dev/tty${tty}`)
			} catch(err) {}
			await somes.sleep(1e3);
		}
	}

	private reportException(tty: string, err: any): void {
		// import {NodeClient as SentryClient} from '@sentry/node';
		// private _sentry_instances: Dict<SentryClient> = {};
	}

	abortOnUncaughtException(abort: boolean) {
		this._abortOnUncaughtException = !!abort;
	}

}