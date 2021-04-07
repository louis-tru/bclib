/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2018-07-19
 */

import utils from 'somes';
import message from './message';
import errno from './errno';

const all_action: Dict<RequestAction> = {};
const DEFAULT_TIMEOUT: number = 30 * 1000; // 30秒

export default class RequestAction {

	private m_name: string;
	private m_timeout: number; =
	private m_timeid: any;
	private m_Promise_ok: any;
	private m_Promise_err: any;

	private constructor(name: string, timeout: number = DEFAULT_TIMEOUT) {
		this.m_name = name;
		this.m_timeout = timeout;
	}

	private _request(data: any): Promise<any> {
		return new Promise((resolve, reject)=>{
			var action = all_action[this.m_name];
			if (action) {
				return reject(Error.new(errno.ERR_LAST_ACTION_NOT_COMPLETED));
			}
			all_action[this.m_name] = this;

			this.m_Promise_ok = resolve;
			this.m_Promise_err = reject;
			this.m_timeid = setTimeout(()=>this._agree(false), this.m_timeout); 
			// 广播动作请求
			message.send(this.m_name, data);
		});
	}

	private _agree(isAgree: boolean, args?: any) {
		var action = all_action[this.m_name];
		utils.assert(action === this);
		delete all_action[this.m_name]
		clearTimeout(this.m_timeid);
		
		var { m_Promise_ok: ok, m_Promise_err: error } = this;

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
