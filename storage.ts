/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from 'somes';
import {IStorage} from 'somes/storage';

class Storage implements IStorage {

	private _data: Dict = {}
	private _init = false;

	async initialize(): Promise<void> {
		utils.assert(!this._init);
		this._init = true;
		// TODO ...
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
