/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import somes from 'somes';
import {Console as Log} from 'somes/log';
import paths from './paths';
import cfg from './cfg';
import { exec } from 'somes/syscall';
import { workers, type } from './env';

export class UncaughtException extends Log {

	private _abortOnUncaughtException = false;

	constructor(path?: string) {
		super(path || `${paths.var}/${cfg.name}.log`, type + '-' + (workers?.id || 0));
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

	fault(msg: any, ...args: any[]) {
		// warning email
		return super.fault(msg, ...args);
	}

	private reportException(tty: string, err: any): void {
		// import {NodeClient as SentryClient} from '@sentry/node';
		// private _sentry_instances: Dict<SentryClient> = {};
	}

	abortOnUncaughtException(abort: boolean) {
		this._abortOnUncaughtException = !!abort;
	}

}