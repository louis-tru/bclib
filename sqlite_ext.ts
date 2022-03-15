/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2018-09-27
 */

import utils from 'somes';

var sqlite3 = require('sqlite3');

if (utils.debug) {
	sqlite3 = sqlite3.verbose();
}

[
	'serialize',
	'close',
	'run',
	'get',
	'all',
	'exec',
	'prepare',
].forEach(asyncext.bind(null, sqlite3.Database));

[
	'bind',
	'reset',
	'finalize',
	'run',
	'get',
	'all',
].forEach(asyncext.bind(null, sqlite3.Statement));

function asyncext(clazz: any, name: string) {
	var func = clazz.prototype[name];
	clazz.prototype[name + '2'] = function(...args: any[]) {
		return new Promise<void>((resolve, reject)=>{
			try {
				func.call(this, ...args, function(err: Error, ...args2: any[]) {
					if (err) {
						err.ext({args});
						reject(err);
					} else {
						resolve(...args2);
					}
				});
			} catch(err: any) {
				err.ext({args});
				reject(err);
			}
		});
	};
}

export default sqlite3;