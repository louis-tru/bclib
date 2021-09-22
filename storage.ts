/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

 import somes from 'somes';
import paths from './paths';
import {IStorage} from 'somes/storage';
import {SQLiteTools} from './sqlite';
import {DatabaseTools} from 'somes/db';

export class Storage implements IStorage {

	private _db?: DatabaseTools;
	private _data: Dict = {};

	private get db() {
		somes.assert(this._db);
		return this._db as DatabaseTools;
	}

	async initialize(db?: DatabaseTools): Promise<void> {
		somes.assert(!this._db);

		this._db = db || new SQLiteTools(`${paths.var}/storage.db`);
		await this._db.load(`
			CREATE TABLE if not exists storage (
				skey     VARCHAR (64) PRIMARY KEY NOT NULL, -- string key
				value    TEXT    NOT NULL
			);
		`, [], [
		], 'bclib/storage');

		this._data = {};

		for (var {skey, value} of await this._db.select('storage')) {
			if (value) {
				try {
					this._data[skey] = JSON.parse(value);
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
			this.db.update('storage', { value: JSON.stringify(value) }, { skey: key });
		} else {
			this.db.insert('storage', { value: JSON.stringify(value), skey: key });
		}
		this._data[key] = value;
	}

	del(key: string): void {
		this.delete(key);
	}

	delete(key: string): void {
		delete this._data[key];
		this.db.delete('storage', { skey: key });
	}

	clear(): void {
		this._data = {};
		this.db.delete('storage');
	}

	commit(): void {
		// TODO ...
	}

	all() {
		return this._data;
	}

}

export default new Storage(); // default storage