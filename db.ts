/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
 */

import * as sqlite from 'bclib/sqlite';
import paths from './paths';

var _defailt = new sqlite.SQLiteTools(`${paths.var}/bclib.db`);

export function initialize() {
	return _defailt.initialize(`
		CREATE TABLE if not exists callback_url (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			url          VARCHAR (255) NOT NULL,
			data         TEXT NOT NULL,
			status       INTEGER DEFAULT (0) NOT NULL -- 0没完成,1完成,2丢弃
		);
		-- CREATE TABLE if not exists tx_queue (
		-- 	id         INTEGER PRIMARY KEY AUTOINCREMENT,
		-- 	url        VARCHAR (255) NOT NULL,
		-- 	data       TEXT
		-- );
	`, [
	], [
		'create unique index callback_url_id on callback_url (id)',
		'create unique index callback_url_status on callback_url (status)',
	]);
}

export default _defailt;