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

	private get db() {
		somes.assert(this._db);
		return this._db as DatabaseTools;
	}

	async initialize(db?: DatabaseTools): Promise<void> {
		somes.assert(!this._db);

		this._db = db || new SQLiteTools(`${paths.var}/storage.db`);

		if (this._db.has('storage')) {
			await this._db.load(`
				CREATE TABLE if not exists storage (
					kkey     VARCHAR (128) PRIMARY KEY NOT NULL, -- string key
					value    TEXT    NOT NULL
				);
			`, [], [
			], 'bclib/storage');
		}
	}

	async get<T = any>(kkey: string, defaultValue?: T) {
		var its = await this.db.select('storage', {kkey}, {limit:1});
		if (its.length) {
			return JSON.parse(its[0].value) as T;
		} else {
			if (defaultValue !== undefined) {
				await this.set(kkey, defaultValue);
			}
			return defaultValue as T;
		}
	}

	async has(kkey: string) {
		var its = await this.db.select('storage', {kkey}, {limit:1});
		return its.length > 0;
	}

	async set(kkey: string, _value: any) {
		var value = JSON.stringify(_value);
		if (this.db instanceof SQLiteTools) { // sqlite
			if (await this.has(kkey)) {
				await this.db.update('storage', { value }, { kkey });
			} else {
				await this.db.insert('storage', { kkey, value });
			}
		} else { // mysql
			var ok = await this.db.update('storage', { value }, { kkey });
			if (!ok) {
				await this.db.insert('storage', { value: value, kkey });
			}
		}
	}

	async delete(kkey: string) {
		await this.db.delete('storage', { kkey });
	}

	async clear() {
		await this.db.delete('storage');
	}

}

export default new Storage(); // default storage