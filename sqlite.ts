/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2018-09-27
 */

import utils from 'somes';
import sqlite3 from './sqlite_ext';
import errno from './errno';
import {DatabaseCRUD,DatabaseTools,Where,Database,SelectOptions,Result} from 'somes/db';

interface DBStructColumn {
	name: string;
	type: string;
}

interface DBStruct {
	names: string[];
	columns: {
		[key: string]: DBStructColumn;
	};
}

interface DBStructMap {
	[key: string]: DBStruct;
}

export interface Collection {
	index: number;
	total: number;
	data: Dict[];
}

function get_sql_params(
	struct: DBStruct, 
	row: Dict, 
	json: boolean= false, 
	prefix: string = ''
) 
{
	var $ = '$' + (prefix || '');
	var { columns } = struct, values: Dict = {};
	var keys = [], $keys = [], exp = [], exp2: string[] = [];
	var raw = {...row};

	Object.entries(row)
	.filter(([k,v])=>k in columns && k!='_json' && v!==undefined)
	.forEach(([k,v])=>{
		keys.push(k);
		$keys.push($ + k);

		var def = struct.columns[k];
		if (def && def.type == 'json') {
			v = JSON.stringify(v);
		}
		values[$ + k] = v;
		exp.push(k + '=' + $ + k);
		// exp2.push(k + '!=' + $ + k);
		delete raw[k];
	});

	if (json && '_json' in columns) {
		delete raw['_json'];
		if (Object.keys(raw).length) {
			keys.push('_json');
			$keys.push($ + '_json');
			values[$ + '_json'] = JSON.stringify(raw);
			exp.push('_json=' + $ + '_json');
			// exp2.push('_json==' + $ + '_json');
		} else {
			json = false;
		}
	} else {
		json = false;
	}

	return { 
		keys,
		$keys,
		values,
		exp,
		exp2,
		json,
	};
}

function get_select_table_name(sql: string, defaultTable: string): string {
	if (!defaultTable) {
		var m = sql.match(/from\s+([^\s]+)/i) as RegExpMatchArray;
		utils.assert(m);
		defaultTable = m[1];
	}
	return defaultTable;
}

function parseJSON(json: string | null) {
	if (json) {
		try {
			return JSON.parse(json);
		} catch(e) {
			console.error(e);
		}
	}
	return null;
}

function selectAfter(struct: DBStruct, ls: Dict[]): Dict[] {
	var jsons = [] as string[];
	var json_ext = '_json' in struct.columns;

	for (var k of struct.names) {
		var d = struct.columns[k];
		if (d.type == 'json')
			jsons.push(k);
	}

	if (!jsons.length && !json_ext) {
		return ls;
	}

	return ls.map(e=>{
		for (var k of jsons) {
			e[k] = parseJSON(e[k]);
		}
		if (json_ext) {
			Object.assign(e, parseJSON(e._json));
			delete e._json;
		}
		return e;
	});
}

/**
 * @class SQLiteTools
 */
export class SQLiteTools implements DatabaseTools {

	private m_db: any = null;
	private m_db_struct: DBStructMap | null = null;
	private m_path: string;
	private _loads: Map<string, [string, string[], string[]]> = new Map();

	private check(table: string): DBStruct {
		var struct = this.dbStruct[table];
		utils.assert(struct, errno.ERR_DATA_TABLE_NOT_FOUND);
		return struct;
	}
	
	get path() { return this.m_path }
	get sqlite() { return this.m_db }
	get dbStruct() { return this.m_db_struct as DBStructMap; }

	constructor(path: string) {
		this.m_path = path;
	}

	private async _Init() {
		if (!this.m_db) {
			var _db = new sqlite3.Database(this.m_path);
			await _db.serialize2();
			this.m_db = _db;
			this.m_db_struct = {} as DBStructMap;
		}
	}

	private _Sql(sql: string) {
		return sql
			.replace(/AUTO_INCREMENT/img, 'AUTOINCREMENT')
			.replace(/DEFAULT\s+(\d+|\'[^\']*\'|true|false|null)/img, 'DEFAULT ($1)')
			.replace(/INT /img, 'INTEGER ')
		;
	}

	async load(SQL: string, SQL_PLUS: string[], SQL_INDEXES: string[], id?: string): Promise<void> {
		await this._Init();
		var _id = id || 'default';
		var _db = this.m_db;
		var _db_struct = this.m_db_struct as DBStructMap;

		utils.assert(!this._loads.has(_id), errno.ERR_REPEAT_LOAD_SQLITE);

		if (SQL)
			await _db.exec2(this._Sql(SQL));

		for (let sql of SQL_PLUS) {
			var [,table_name,table_column] = sql.match(/^alter\s+table\s+(\w+)\s+add\s+(\w+)/) as RegExpMatchArray;
			var res = await _db.all2(
				`select * from sqlite_master where type='table' 
				 and name=? and sql like ?`, table_name, `%${table_column}%`);
			if (!res.length) {
				await _db.exec2(sql);
			}
		}

		for (let sql of SQL_INDEXES) {
			var [,,name,table] = sql.match(/^create\s+(unique\s+)?index\s+(\w+)\s+on\s+(\w+)/i) as RegExpMatchArray;
			var res = await _db.all2(
				`select * from sqlite_master where type='index' and name = ? and tbl_name = ?`, name, table);
			if (res.length) {
				if (res[0].sql.replace(/\s+/g, ' ').toLowerCase() != sql.replace(/\s+/g, ' ').toLowerCase()) {
					await _db.exec2(`drop index ${name}`);
				} else {
					continue;
				}
			}
			await _db.exec2(sql);
		}
		
		var r = await _db.all2(`select * from sqlite_master where type='table'`);
		for (let {name} of r) {
			if (name != 'sqlite_sequence') {
				var struct: DBStruct = _db_struct[name] = { names: [], columns: {}, };
				(await _db.all2(`pragma table_info(${name})`)).forEach((e: any)=>{
					struct.names.push(e.name);
					struct.columns[e.name] = { ...e, type: e.type.toLowerCase() } as DBStructColumn;
				});
			}
		}

		this._loads.set(_id, [SQL, SQL_PLUS, SQL_INDEXES]);
	}

	close(): Promise<any> { return this.m_db.close2() }
	private _Exec(sql: string, values?: Dict): Promise<void> { return this.m_db.run2(sql, values) } // no result
	private _Query(sql: string, values?: Dict): Promise<any[]> { return this.m_db.all2(sql, values) } // get result

	async exec(sql: string) {
		// TODO not impl ..
		console.warn('Incomplete implementation');
		var r = await this._Query(sql);
		if (r && Array.isArray(r))
			return [{ rows: r }] as Result[];
		return [] as Result[];
	}

	has(table: string): boolean { return table in this.dbStruct }

	async insert(table: string, row: Dict): Promise<number> {
		return await utils.scopeLock(this.m_db, async ()=>{
			var struct = this.check(table);
			var { keys, $keys, values } = get_sql_params(struct, row, true);
			var sql = `insert into ${table} (${keys.join(',')}) values (${$keys.join(',')})`;
			await this._Exec(sql, values);
			var r = await this._Query('select last_insert_rowid() as id');
			return r[0].id as number;
		});
	}

	async update(table: string, row: Dict, where: Where = ''): Promise<number> {
		var struct = this.check(table);
		var { values, exp, json } = get_sql_params(struct, row, true);
		var is_where_object = typeof where == 'object';
		if (is_where_object) {
			var { values: values2, exp: exp2 } = get_sql_params(struct, where as Dict, false, '_');
		}
		if (json) {
			var r;
			if (is_where_object) {
				r = await this.m_db.get2(`select _json from ${table} where ${exp2.join(' and ')}`, values2);
			} else {
				r = await this.m_db.get2(`select _json from ${table} where ${where}`);
			}
			if (r) {
				try {
					row = Object.assign({}, JSON.parse(r._json), row);
					values = get_sql_params(struct, row, true).values;
				} catch(e) {
					console.error(e);
				}
			}
		}
		if (is_where_object) {
			var sql = `update ${table} set ${exp.join(',')} where ${exp2.join(' and ')}`;
			await this._Exec(sql, Object.assign(values, values2));
		} else {
			var sql = `update ${table} set ${exp.join(',')} where ${where}`;
			await this._Exec(sql, values);
		}
		return 0; // TODO ...
	}

	async delete(table: string, where: Where = ''): Promise<number> {
		var struct = this.check(table);
		if (typeof where == 'object') {
			var { values, exp } = get_sql_params(struct, where);
			await this._Exec(`delete from ${table} where ${exp.join(' and ')}`, values);
		} else {
			await this._Exec(`delete from ${table} ${where ? 'where ' + where: ''}`);
		}
		return 0; // TODO ...
	}

	async select<T = Dict>(table: string, where: Where = '', opts: SelectOptions = {}): Promise<T[]> {
		var struct = this.check(table);
		var sql, ls;
		var limit_str = '';
		if (opts.limit) {
			limit_str = Array.isArray(opts.limit) ? ' limit ' + opts.limit.join(','): ' limit ' + opts.limit;
		}
		var group = opts.group ? `group by ${opts.group}`: '';
		var order = opts.order ? `order by ${opts.order}`: '';
		if (where) {
			if (typeof where == 'object') {
				var { exp, values } = get_sql_params(struct, where);
				if (exp.length) {
					sql = `select * from ${table} where ${exp.join(' and ')} ${group} ${order} ${limit_str}`;
				} else {
					sql = `select * from ${table} ${group} ${order} ${limit_str}`;
				}
				// console.log(sql, values)
				ls = await this._Query(sql, values);
			} else {
				sql = `select * from ${table} where ${where} ${group} ${order} ${limit_str}`
				ls = await this._Query(sql);
			}
		} else {
			sql = `select * from ${table} ${group} ${order} ${limit_str}`;
			ls = await this._Query(sql);
		}
		return selectAfter(struct, ls) as T[];
	}

	async selectOne<T = Dict>(table: string, where: Where = '', opts: SelectOptions = {}): Promise<T|null> {
		var [s] = await this.select<T>(table, where, {limit: 1, ...opts});
		return s || null;
	}

	async query<T = Dict>(sql: string, table: string = ''): Promise<T[]> {
		table = get_select_table_name(sql, table);
		return selectAfter(this.check(table), await this._Query(sql)) as T[];
	}

	async deleteById(table: string, id: number): Promise<any> {
		return await this.delete(table, { id });
	}

	async getById(table: string, id: number): Promise<Dict | null> {
		return (await this.select(table, { id }, {limit:1}))[0] || null;
	}

	// @obsolete
	async get(sql: string, table: string = ''): Promise<Dict | null> {
		// this.m_db.get2(`select _json from ${table} where ${exp2.join(' and ')}`, values2);
		return (await this.gets(sql, table))[0] || null;
	}

	// @obsolete
	gets(sql: string, table: string = '') {
		return this.query(sql, table);
	}

	async clear() {
		for (var table of Object.keys(this.dbStruct)) {
			await this._Exec(`delete from ${table}`);
		}
	}

	scope<T = any>(cb: (db: DatabaseCRUD, self: DatabaseTools)=>Promise<T>): Promise<T> {
		return cb(this, this);
	}

	transaction<T = any>(cb: (db: DatabaseCRUD, self: DatabaseTools)=>Promise<T>): Promise<T> {
		return cb(this, this);
	}

	db(): Database {
		throw Error.new('Not IMPL');
	}

}