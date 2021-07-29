/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import cfg  from './cfg';
// import * as fs from 'somes/fs2';
import somes from 'somes';
import buffer from 'somes/buffer';
import errno from './errno';

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
var _applications: ApplicationInfo[] = [];
var _allApplications: ApplicationInfo[] = [];
var _applicationsIndexed: Dict<ApplicationInfo> | null = null;

function updateApplicationsIndexed() {
	_allApplications = insides().concat(_applications);
	_applicationsIndexed = {};
	for (var app of _allApplications) {
		_applicationsIndexed[app.appId] = app;
	}
}

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
		updateApplicationsIndexed();
	}
	return _insides;
}

export function applications(): ApplicationInfo[] {
	return _applications;
}

export function setApplications(apps: ApplicationInfo[]) {
	_applications = apps;
	updateApplicationsIndexed();
}

export function allApplications() {
	return _allApplications;
}

export function application(appId: string) {
	var app = applicationWithoutErr(appId);
	somes.assert(app, errno.ERR_APPLICATION_FOUND);
	return app;
}

export function applicationWithoutErr(appId: string): ApplicationInfo | null {
	if (!_applicationsIndexed) {
		updateApplicationsIndexed();
	}
	var indexed = _applicationsIndexed as Dict<ApplicationInfo>;
	return indexed[appId] || null;
}