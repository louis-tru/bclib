/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import * as fs from 'somes/fs';
import paths from './paths';
import * as path from 'path';
// import service from 'somes/service';
import {Descriptors} from 'somes/http_service';
import cfg_ from './cfg';
import {ServerIMPL,Options} from 'somes/server';

export const cfg = {
	temp: `${paths.var}/temp`,
	root: `${__dirname}/../../public`,
	port: 8000,
	host: '127.0.0.1',
	autoIndex: cfg_.autoIndex,
	printLog: true,
	defaults: ['index.html', 'index.htm', 'default.html'],
	maxFileSize:        1024 * 1024 * 1024, // 1024MB
	maxFormDataSize:    50   * 1024 * 1024, // 50MB
	maxUploadFileSize:  50   * 1024 * 1024, // 50MB
	router: [] as any[],
	timeout: 180 * 1e3, // 180s
	formHash: 'sha256',
	tryFiles: '',
	trySuffixs: '',
};

Object.assign(cfg, cfg_.server);

// router
cfg.router.push({
	match: '/files/{action}/{pathname}',
	service: 'files',
});

export class Server extends ServerIMPL {
	constructor(config?: Options) {
		super(Object.assign({}, config, cfg));

		// register service test
		if (cfg_.env == 'dev' || cfg_.env == 'rel') {
			for (var e of cfg_.tests || []) {
				var {name,dir} = path.parse(e);
				this.setService(name, require(e).default(name, dir));
				cfg.router.push({ match: `/${name}/{test_name}`, service: name, action: 'index' });
			}
			// service.set('test-ws', require('./test/test-ws').default);
		}

		this.removeService('descriptors'); // delete descriptors service
		this.setService('descriptors', class extends Descriptors {
			descriptors() {
				// this.markReturnInvalid();
				this.setNoCache();
				this.returnErrorStatus(404);
				return {};
			}
		});
	}

	private setAPIs() {
		// register service
		cfg_.apis.forEach(dir=>{
			if (fs.existsSync(dir)) {
				fs.readdirSync(dir).forEach((e)=> {
					var {name,ext} = path.parse(e);
					if (ext == '.js' && name[0] != '_') {
						if (fs.statSync(`${dir}/${e}`).isFile())
							this.setService(name, require(`${dir}/${name}`).default);
					}
				});
			}
		});
		this.removeService('descriptors'); // delete descriptors service
		this.setService('descriptors', Descriptors); // add descriptors service
	}

	async start() {
		await super.start();
		this.setAPIs();
	}

}
