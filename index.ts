/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
 */

import {initialize as db_initialize} from './db';
import storage from './storage';
import auth from './auth';

export async function initialize () {
	await db_initialize();
	await storage.initialize();
	await auth.initialize();
}