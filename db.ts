/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
 */

import * as sqlite from 'bclib/sqlite';
import paths from './paths';
import {DatabaseTools} from 'somes/db';
import cfg from './cfg';

var _default: DatabaseTools = new sqlite.SQLiteTools(`${paths.var}/bclib.db`);

export function initialize(db?: DatabaseTools) {
	if (db)
		exports.default = _default = db;
	else
		db = _default;

	if (cfg.fastStart) {
		return db.load(``, [], [], 'bclib');
	}

	return db.load(`
		CREATE TABLE if not exists callback_url (
			id           INT PRIMARY KEY AUTO_INCREMENT,
			url          VARCHAR (255) NOT NULL,
			data         TEXT NOT NULL,
			status       INT DEFAULT 0 NOT NULL, -- 0没完成,1完成,2丢弃,3处理中
			active       bigint default (0) NOT NULL
		);
		CREATE TABLE if not exists tx_async (
			id         INT PRIMARY KEY AUTO_INCREMENT,
			account    VARCHAR (128),
			contract   VARCHAR (128),
			method     VARCHAR (64),
			args       TEXT,
			opts       TEXT,
			data       TEXT,
			cb         VARCHAR (255),
			txid       VARCHAR (255),
			status     INT DEFAULT (0) NOT NULL, -- 1进行中,2完成,3失败
			time       bigint DEFAULT (0) NOT NULL,
			active     bigint default (0) NOT null
		);
		create table if not exists auth_user(
			id         int PRIMARY KEY AUTO_INCREMENT,
			name       varchar (64)         not null,
			pkey       text   not null,
			key2       varchar (128),
			keyType    varchar (32) default ('') not null,
			mode       int default (0)  not null,
			interfaces text,
			time       bigint not null,
			ref        varchar (128) default ('') not null
		);
	`, [
		`alter table tx_async     add time    bigint DEFAULT (0) NOT NULL`,
		`alter table auth_user    add keyType varchar (32) default ('') not null`,
		`alter table auth_user    add ref     varchar (128) default ('') not null`,
		`alter table auth_user    add key2    varchar (128)`,
		`alter table callback_url add active  bigint  default (0)  not null`,
		`alter table tx_async     add active  bigint  default (0)  not null`,
	], [
		'create unique index callback_url_id     on callback_url (id)',
		'create        index callback_url_status on callback_url (status)',
		'create unique index tx_async_id     on tx_async (id)',
		'create        index tx_async_status on tx_async (status)',
		'create unique index auth_user_name on auth_user (name)',
		'create        index auth_user_mode on auth_user (mode)',
	], 'bclib');
}

export default _default;