/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from 'somes';
import paths from './paths';
import {IStorage} from 'somes/storage';
import {SQLiteTools} from './sqlite';

class Storage implements IStorage {

	private _db: SQLiteTools = new SQLiteTools(`${paths.var}/storage.db`);
	private _data: Dict = {}
	private _init = false;

	async initialize(): Promise<void> {
		utils.assert(!this._init);
		this._init = true;
		await this._db.initialize(`
			CREATE TABLE if not exists util (
				key         VARCHAR (64) PRIMARY KEY NOT NULL,
				value       TEXT    NOT NULL
			);
		`, [], [
			'create unique index util_indexes    on util (key)'
		]);

		for (var {key, value} of await this._db.select('util')) {
			if (value) {
				try {
					this._data[key] = JSON.parse(value);
				} catch(err) {
					console.error(err);
				}
			}
		}
	}

	get(key: string, defaultValue?: any) {
		if (key in this._data) {
			return this._data[key];
		} else {
			if (defaultValue !== undefined) {
				this.set(key, defaultValue);
				return defaultValue;
			}
		}
	}

	has(key: string): any {
		return key in this._data;
	}

	set(key: string, value: any): void {
		utils.assert(this._init);
		if (key in this._data) {
			// db.update('util', { value: JSON.stringify(value) }, { key });
		} else {
			// db.insert('util', { key, value: JSON.stringify(value) });
		}
		this._data[key] = value;
	}

	del(key: string): void {
		this.delete(key);
	}

	delete(key: string): void {
		utils.assert(this._init);
		delete this._data[key];
		// db.delete('util', { key });
	}

	clear(): void {
		utils.assert(this._init);
		this._data = {};
		// db.delete('util');
	}

	commit(): void {
		// TODO ...
	}

	all() {
		return this._data;
	}

}

export default new Storage();