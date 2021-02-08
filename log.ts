/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import somes from 'somes';
import {Console as ConsoleBase} from 'somes/log';
import paths from './paths';
import cfg from './cfg';
import { exec } from 'somes/syscall';

export class Console extends ConsoleBase {

	constructor(path?: string) {
		super(path || `${paths.var}/${cfg.name}.log`);

		somes.onUncaughtException.on((e)=>{
			this.error(e.data.reason);
			this.reportException(cfg.name, e.data);
		});

		somes.onUnhandledRejection.on((e)=>{
			this.error(e.data.reason);
			this.reportException(cfg.name, e.data);
		});
		
	}

	async watch(logPaht: string, tty: number) {
		while(true) {
			try {
				await exec(`tail -f ${logPaht} > /dev/tty${tty}`)
			} catch(err) {}
			await somes.sleep(1e3);
		}
	}

	reportException(tty: string, err: any): void {
		// if (err) {
		// 	var sentry = this._sentry_instances[tty];
		// 	if (sentry) {
		// 		sentry.captureException(Error.new(err));
		// 	}
		// }
	}

	async initialize() {
		// const { NodeClient: SentryClient } = await import('@sentry/node');
		// const {default: device} = await import('./device')
		// var releases: Dict<string> = {
		// 	'dphoto-hw': device. hardwareVersion,
		// 	'dphoto-magic': device.softwareVersion,
		// };
		// // install sentry
		// Object.entries({ ...utils.config.sentry }).forEach(([tty,dsn])=>{
		// 	this._sentry_instances[tty] = new SentryClient({
		// 		dsn: dsn as string,
		// 		serverName: device.serialNumber,
		// 		release: releases[tty] || '',
		// 		environment: utils.config.env,
		// 	});
		// });
	}

}