/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
 */

import * as db from './db';
import * as utils from './utils';
import storage from './storage';
import auth from './auth';

export async function initialize () {
	console.time('bclib init');
	await db.initialize();
	console.timeLog('bclib/db init');
	await utils.initialize();
	console.timeLog('bclib/utils init');
	await storage.initialize();
	console.timeLog('bclib/storage init');
	await auth.initialize();
	console.timeLog('bclib/auth init');
	console.timeEnd('bclib init ok');
}