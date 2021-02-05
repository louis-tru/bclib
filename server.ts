/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import {prod} from './utils';
import * as fs from 'somes/fs';
import paths from './paths';
import * as path from 'path';
import server, {ServerIMPL} from 'somes/server';
import service from 'somes/service';
import {Descriptors} from 'somes/http_service';
import cfg_ from './cfg';

const cfg = {
	temp: `${paths.var}/temp`,
	root: `${__dirname}/../public`,
	port: 8000,
	host: '127.0.0.1',
	autoIndex: !prod,
	printLog: true,
	defaults: ['index.html', 'index.htm', 'default.html'],
	maxFileSize: 				1024 * 1024 * 1024, // 1024MB
	maxFormDataSize:		50   * 1024 * 1024, // 50MB
	maxUploadFileSize: 	50   * 1024 * 1024, // 50MB
	router: [],
	timeout: 180 * 1e3, // 180s
	...cfg_.server as any,
};

// router

cfg.router.push({
	match: '/files/{action}/{pathname}',
	service: 'files',
});

// register service test
if (!prod) {
	cfg.router.push({
		match: '/test/{test_name}',
		service: 'test',
		action: 'index',
	});
	service.set('test', require('../test/test').default);
	service.set('test-ws', require('../test/test-ws').default);
}

service.del('descriptors'); // delete descriptors service
service.set('descriptors', class extends Descriptors {
	descriptors() {
		// this.markReturnInvalid();
		this.setNoCache();
		this.returnErrorStatus(404);
		return {};
	}
});

function initializeApi() {
	// register service
	['api'].forEach(dir=>{
		fs.readdirSync(`${__dirname}/${dir}`).forEach((name)=> {
			if (path.extname(name) == '.js' && name[0] != '_') {
				if (fs.statSync(`${__dirname}/${dir}/${name}`).isFile()) {
					service.set(name.replace('.js', ''), require(`./${dir}/${name}`).default);
				}
			}
		});
	});
	service.del('descriptors'); // delete descriptors service
	service.set('descriptors', Descriptors); // add descriptors service
}

const impl = new ServerIMPL(cfg);

export default {
	server: impl,
	initializeApi,
};

// start server
server.setShared(impl);