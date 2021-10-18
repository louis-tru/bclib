/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
 */

import {DatabaseTools} from 'somes/db';
import * as _db from './db';
import * as utils from './utils';
import storage from './storage';
import auth from './auth';

export async function initialize(db?: DatabaseTools, l_db?: DatabaseTools) {
	console.time('bclib init');
	await _db.initialize(db); console.timeLog('bclib/db init');
	await utils.initialize(); console.timeLog('bclib/utils init');
	await storage.initialize(l_db); console.timeLog('bclib/storage init');
	await auth.impl.initialize(); console.timeLog('bclib/auth init');
	console.timeEnd('bclib init ok');
}