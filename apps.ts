/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import cfg  from './cfg';
import * as fs  from 'somes/fs2';
import buffer from 'somes/buffer';

export interface ApplicationInfo {
	name: string;
	displayName: string;
	icon: string;
	appId: string;
	appKey: string;
	keyType?: 'rsa'| 'secp256k1';
	version: string;
	// filesHash: Dict<string>;
}

var _insides: ApplicationInfo[] | null = null;
var _applications: ApplicationInfo[] | null = null;

export function insides(): ApplicationInfo[] {
	if (!_insides) {
		_insides = [];
		var auhorizationtApps = cfg.auhorizationtApps;
		if (auhorizationtApps) {
			for (var app of auhorizationtApps) {
				if (!app.keyType || app.keyType == 'secp256k1') {
					if (app.appKey.substr(0, 2) != '0x') { //base64
						app.appKey = '0x' + buffer.from(app.appKey, 'base64').toString('hex')
					}
				}
				_insides.push({ icon: '', displayName: '', name: '', version: '', ...app });
			}
		}
		var dphoto_factory = '/mnt/app/software/static/dphoto-factory/app.json';
		if (fs.existsSync(dphoto_factory)) {
			let app = JSON.parse(fs.readFileSync(dphoto_factory) + '');
			_insides.push(app);
		}
	}
	return _insides;
}

export function applications(): ApplicationInfo[] {
	if (!_applications) {
		_applications = [];
	}
	// TODO ...
	return _applications;
}

export function all() {
	return applications().concat(insides());
}

export function applicationWithoutErr(appId: string): ApplicationInfo | null {
	return insides().find(e=>e.appId == appId) || null;
}
