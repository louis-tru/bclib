/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import paths from './paths';
import {IStorage} from 'somes/storage';
import {SQLiteTools} from './sqlite';

export class Storage implements IStorage {

	private _db?: SQLiteTools;
	private _data: Dict = {};

	get db() {
		return this._db as SQLiteTools;
	}

	async initialize(db?: SQLiteTools): Promise<void> {
		if (!db) {
			if (!this._db) {
				this._db = new SQLiteTools(`${paths.var}/storage.db`);
				await this._db.initialize(`
					CREATE TABLE if not exists storage (
						key         VARCHAR (64) PRIMARY KEY NOT NULL,
						value       TEXT    NOT NULL
					);
				`, [], [
				]);
			}
		} else {
			this._db = db;
		}

		this._data = {};

		for (var {key, value} of await this._db.select('storage')) {
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
		if (key in this._data) {
			this.db.update('util', { value: JSON.stringify(value) }, { key });
		} else {
			this.db.insert('util', { key, value: JSON.stringify(value) });
		}
		this._data[key] = value;
	}

	del(key: string): void {
		this.delete(key);
	}

	delete(key: string): void {
		delete this._data[key];
		this.db.delete('util', { key });
	}

	clear(): void {
		this._data = {};
		this.db.delete('util');
	}

	commit(): void {
		// TODO ...
	}

	all() {
		return this._data;
	}

}

export default new Storage(); // default storage