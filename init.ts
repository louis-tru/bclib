/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
 */

import {DatabaseTools} from 'somes/db';
import * as _db from './db';
import storage from './storage';
import auth from './auth';
import {Notification} from 'somes/event';
import * as lock from './atomic_lock';

export async function initialize(db?: DatabaseTools, l_db?: DatabaseTools, msg?: Notification) {
	console.time('bclib init');
	await _db.initialize(db); console.timeLog('bclib/db init');
	await storage.initialize(l_db); console.timeLog('bclib/storage init');
	await auth.impl.initialize(msg); console.timeLog('bclib/auth init');
	await lock.initialize();
	console.timeEnd('bclib init ok');
}