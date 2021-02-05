/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import utils from 'somes';
import message from './message';
import errno from './errno';

const all_action: Dict<RequestAction> = {};
const DEFAULT_TIMEOUT: number = 30 * 1000; // 30秒

export default class RequestAction {

	private _name: string;
	private _timeout: number;
	private _timeid: any;
	private _Promise_ok: any;
	private _Promise_err: any;

	private constructor(name: string, timeout: number = DEFAULT_TIMEOUT) {
		this._name = name;
		this._timeout = timeout;
	}

	private _request(data: any): Promise<any> {
		return new Promise((resolve, reject)=>{
			var action = all_action[this._name];
			if (action) {
				return reject(Error.new(errno.ERR_LAST_ACTION_NOT_COMPLETED));
			}
			all_action[this._name] = this;

			this._Promise_ok = resolve;
			this._Promise_err = reject;
			this._timeid = setTimeout(()=>this._agree(false), this._timeout); 
			// 广播动作请求
			message.send(this._name, data);
		});
	}

	private _agree(isAgree: boolean, args?: any) {
		var action = all_action[this._name];
		utils.assert(action === this);
		delete all_action[this._name]
		clearTimeout(this._timeid);
		
		var { _Promise_ok: ok, _Promise_err: error } = this;

		if (isAgree) {
			ok(args);
		} else {
			error(Error.new(errno.ERR_USER_FORBIDDEN_ACTION));
		}
	}

	static async request(name: string, data: any, timeout: number = DEFAULT_TIMEOUT) {
		var action = new RequestAction(name, timeout);
		return await action._request(data);
	}

	static agree(name: string, isAgree: boolean, args?: any) {
		var action = all_action[name];
		if (action) {
			action._agree(isAgree, args);
		} else {
			throw Error.new(errno.ERR_NOT_ACTION_CONTEXT);
		}
	}

}
