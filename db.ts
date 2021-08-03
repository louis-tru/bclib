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
		CREATE TABLE if not exists tx_async (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			account    VARCHAR (128),
			contract   VARCHAR (128),
			method     VARCHAR (64),
			args       TEXT,
			opts       TEXT,
			data       TEXT,
			cb         VARCHAR (255),
			txid       VARCHAR (255),
			status     INTEGER DEFAULT (0) NOT NULL, -- 1进行中,2完成,3失败
			time       INTEGER DEFAULT (0) NOT NULL
		);
		create table if not exists auth_user(
			id         integer PRIMARY KEY AUTOINCREMENT,
			name       varchar (64)         not null,
			key        text    default ('') not null,
			mode       integer default (0)  not null,
			interfaces text,
			time       integer not null
		);
	`, [
		'alter table tx_async add time INTEGER DEFAULT (0) NOT NULL',
	], [
		'create unique index callback_url_id     on callback_url (id)',
		'create        index callback_url_status on callback_url (status)',
		'create unique index tx_async_id     on tx_async (id)',
		'create        index tx_async_status on tx_async (status)',
		'create unique index auth_user_name on auth_user (name)',
		'create        index auth_user_mode on auth_user (mode)',
	]);
}

export default _defailt;