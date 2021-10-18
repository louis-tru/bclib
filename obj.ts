/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-07-29
 */

export interface DefaultConstructor<T> {
	new(): T;
}

export class StaticObject<T> {

	private _impl?: T;
	private _defaultIMPL: DefaultConstructor<T>;

	constructor(defaultIMPL: DefaultConstructor<T>) {
		this._defaultIMPL = defaultIMPL;
	}

	get impl() {
		if (!this._impl) {
			this._impl = new this._defaultIMPL();
		}
		return this._impl;
	}

	set_impl(impl: T) {
		this._impl = impl;
	}

}