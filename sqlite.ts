/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2018-09-27
 */

import utils from 'somes';
import sqlite3 from './sqlite_ext';
import errno from './errno';

interface DBStructColumn {
	name: string;
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

export type Result = Dict;

export interface Collection {
	index: number;
	total: number;
	data: Result[];
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
	.filter(([k])=>k in columns && k!='_json')
	.forEach(([k,v])=>{
		keys.push(k);
		$keys.push($ + k);
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

function selectAfter(struct: DBStruct, ls: Result[]): Result[] {
	if (!('_json' in struct.columns)) {
		return ls;
	}
	return ls.map(e=>{
		var json = e._json;
		if (!json) return e;
		delete e._json;
		try {
			json = JSON.parse(json);
			return Object.assign({}, json, e);
		} catch(e) {
			return e;
		}
	});
}

/**
 * @class SQLiteTools
 */
export class SQLiteTools {
	
	private m_db: any = null;
	private m_db_struct: DBStructMap | null = null;
	private m_path: string;

	private check(table: string): DBStruct {
		var struct = this.dbStruct[table];
		utils.assert(struct, errno.ERR_DATA_TABLE_NOT_FOUND);
		return struct;
	}
	
	get path() { return this.m_path }
	get db() { return this.m_db }
	get dbStruct() { return this.m_db_struct as DBStructMap; }

	constructor(path: string) {
		this.m_path = path;
	}

	async initialize(SQL: string, SQL_PLUS: string[], SQL_INDEXES: string[]): Promise<void> {
		utils.assert(!this.m_db);
		var _db = new sqlite3.Database(this.m_path);
		var _db_struct: DBStructMap = {};
		await _db.serialize2();
		await _db.exec2(SQL);

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
					struct.columns[e.name] = e as DBStructColumn;
				});
			}
		}
		this.m_db = _db;
		this.m_db_struct = _db_struct;
	}

	close(): Promise<any> { return this.m_db.close2() }
	run(sql: string, values?: Dict): Promise<any> { return this.m_db.run2(sql, values) }
	exec(sql: string): Promise<any> { return this.m_db.exec2(sql) }
	hasTable(table: string): boolean { return table in this.dbStruct }

	async insert(table: string, row: Object, id?: string): Promise<any> {
		var struct = this.check(table);
		var { keys, $keys, values } = get_sql_params(struct, row, true);
		var sql = `insert into ${table} (${keys.join(',')}) values (${$keys.join(',')})`;
		if (id) {
			sql += '; select last_insert_rowid();'
		}
		return await this.run(sql, values);
	}

	async update(table: string, row: Dict, where: Dict | string = ''): Promise<any> {
		var struct = this.check(table);
		var { values, exp, json } = get_sql_params(struct, row, true);
		var is_where_object = typeof where == 'object';
		if (is_where_object) {
			var { values: values2, exp: exp2 } = get_sql_params(struct, where as Dict, false, '_');
		}
		if (json) {
			var r;
			if (is_where_object) {
				r = await this.m_db.get2(`select _json from ${table} where ${exp2.join('and')}`, values2);
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
			var sql = `update ${table} set ${exp.join(',')} where ${exp2.join('and')}`;
			return await this.run(sql, Object.assign(values, values2));
		} else {
			var sql = `update ${table} set ${exp.join(',')} where ${where}`;
			return await this.run(sql, values);
		}
	}

	async delete(table: string, where: object | string = ''): Promise<any> {
		var struct = this.check(table);
		if (typeof where == 'object') {
			var { values, exp } = get_sql_params(struct, where);
			return await this.run(`delete from ${table} where ${exp.join('and')}`, values);
		} else {
			return await this.run(`delete from ${table} ${where ? 'where ' + where: ''}`);
		}
	}

	async select(table: string, where: object | string = '', limit: number = 0): Promise<Result[]> {
		var struct = this.check(table);
		var sql, ls;
		var limit_str = limit ? ' limit ' + limit: '';
		if (where) {
			if (typeof where == 'object') {
				var { exp, values } = get_sql_params(struct, where);
				sql = `select * from ${table} where ${exp.join('and')}${limit_str}`;
				ls = await this.m_db.all2(sql, values);
			} else {
				sql = `select * from ${table} where ${where}${limit_str}`
				ls = await this.m_db.all2(sql);
			}
		} else {
			sql = `select * from ${table}${limit_str}`;
			ls = await this.m_db.all2(sql);
		}
		return selectAfter(struct, ls);
	}

	async deleteById(table: string, id: number): Promise<any> {
		return await this.delete(table, { id });
	}

	async getById(table: string, id: number): Promise<Result | null> {
		return (await this.select(table, { id }, 1))[0] || null;
	}

	async get(sql: string, table: string = ''): Promise<Result | null> {
		table = get_select_table_name(sql, table);
		var data = await this.m_db.get2(sql);
		if (data) {
			return selectAfter(this.check(table), [data])[0];
		}
		return null;
	}

	async gets(sql: string, table: string = ''): Promise<Result[]> {
		table = get_select_table_name(sql, table);
		return selectAfter(this.check(table), await this.m_db.all2(sql));
	}

	async clear() {
		for (var table of Object.keys(this.dbStruct)) {
			await this.run(`delete from ${table}`);
		}
	}

}