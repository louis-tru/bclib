/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
 */

import * as sqlite from 'bclib/sqlite';
import paths from './paths';
import {DatabaseTools} from 'somes/db';
import cfg from './cfg';

var _default: DatabaseTools = new sqlite.SQLiteTools(`${paths.var}/bclib.db`);

export async function initialize(db?: DatabaseTools) {
	if (db) {
		exports.default = _default = db;
	} else {
		db = _default;
	}

	if (cfg.fastStart) {
		await db.load(``, [], [], 'bclib');
		return;
	}

	await db.load(`
		CREATE TABLE if not exists callback_url (
			id           INT PRIMARY KEY AUTO_INCREMENT,
			url          varchar (255) not null,
			data         text   not null,
			state        int    DEFAULT (0) NOT NULL, -- 0init,1处理中,2完成,3丢弃
			active       bigint default (0) NOT NULL,
			retry        int    default (0) NOT NULL
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
			status     INT DEFAULT (0) NOT NULL, -- 0未发送,1进行中,2完成,3失败
			time       bigint DEFAULT (0) NOT NULL,
			active     bigint default (0) NOT null,
			chain      int    default (1) NOT null,
			nonce      int    default (0) NOT null,
			noneConfirm int   default (0) NOT null
		);
		create table if not exists tx_async_queue(
			id          int PRIMARY KEY AUTO_INCREMENT,
			tx_async_id int     not null
		);
		create table if not exists auth_user(
			id         int PRIMARY KEY AUTO_INCREMENT,
			name       varchar (64)         not null,
			pkey       text                 not null,
			key2       varchar (128),
			keyType    varchar (32) default ('') not null,
			mode       int default (0)  not null,
			interfaces text,
			time       bigint not null,
			ref        varchar (128) default ('') not null
		);
	`, [
		`alter table tx_async     add time    bigint DEFAULT (0) NOT NULL`,
		`alter table tx_async     add chain   int    default (1)  not null`,
		`alter table tx_async     add active  bigint  default (0)  not null`,
		`alter table tx_async     add nonce   int     default (0)  not null`,
		`alter table tx_async     add noneConfirm int     default (0)  not null`,
		`alter table auth_user    add keyType varchar (32) default ('') not null`,
		`alter table auth_user    add ref     varchar (128) default ('') not null`,
		`alter table auth_user    add key2    varchar (128)`,
		`alter table callback_url add active  bigint  default (0)  not null`,
		`alter table callback_url add retry   int     default (0)  not null`,
		`alter table callback_url add state   int     default (0)  not null`,
	], [
		'create        index callback_url_status on callback_url (state)',
		'create        index tx_async_status on tx_async(status)',
		'create        index tx_async_time   on tx_async(time)',
		'create        index tx_async_chain  on tx_async(chain)',
		'create unique index auth_user_name  on auth_user(name)',
		'create        index auth_user_mode  on auth_user(mode)',
		'create unique index tx_async_queue_idx0 on tx_async_queue(tx_async_id)',
	], 'bclib');

	await db.load(`
		create table if not exists tasks (
			id           int primary        key auto_increment, -- 主键id
			name         varchar (64)                 not null, -- 任务名称, MekeDAO#Name
			args         json,                                  -- 执行参数数据
			data         json,                                  -- 成功或失败的数据 {data, error}
			step         int          default (0)     not null, -- 当前执行步骤
			stepTime     bigint       default (0)     not null, -- 当前执行步骤的超时时间,可用于执行超时检查
			user         varchar (64) default ('')    not null, -- 与用户的关联,完成后可以通知到客户端
			state        int          default (0)     not null, -- 0进行中,1完成,2失败
			time         bigint                       not null
		);
		`, [], [
		`create         index tasks_idx0    on    tasks          (name,state)`,
		`create         index tasks_idx1    on    tasks          (name)`,
		`create         index tasks_idx2    on    tasks          (state)`,
		`create         index tasks_idx3    on    tasks          (user)`,
	], `bclib-task`);
}

export default _default;