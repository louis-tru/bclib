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
				kkey     VARCHAR (128) PRIMARY KEY NOT NULL, -- string key
				value    TEXT    NOT NULL
			);
		`, [], [
		], 'bclib/storage');

		this._data = {};

		for (var {kkey, value} of await this._db.select('storage')) {
			if (value) {
				try {
					this._data[kkey] = JSON.parse(value);
				} catch(err) {
					console.error(err);
				}
			}
		}
	}

	get(kkey: string, defaultValue?: any) {
		if (kkey in this._data) {
			return this._data[kkey];
		} else {
			if (defaultValue !== undefined) {
				this.set(kkey, defaultValue);
				return defaultValue;
			}
		}
	}

	has(kkey: string): any {
		return kkey in this._data;
	}

	set(kkey: string, value: any): void {
		if (kkey in this._data) {
			this.db.update('storage', { value: JSON.stringify(value) }, { kkey });
		} else {
			this.db.insert('storage', { value: JSON.stringify(value), kkey });
		}
		this._data[kkey] = value;
	}

	del(kkey: string): void {
		this.delete(kkey);
	}

	delete(kkey: string): void {
		delete this._data[kkey];
		this.db.delete('storage', { kkey });
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