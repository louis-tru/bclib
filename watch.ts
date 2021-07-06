/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {getLocalNetworkHost} from 'somes/network_host';
import {Monitor} from 'somes/monitor';
import {MessagePost} from 'bclib/message';

const RUN_INTERVAL = 60 * 1000; // 60s
const [host] = getLocalNetworkHost();
const pid = process.pid;

export interface WatchCat<T = any> {
	name?: string;
	catcount?: number;
	cattime?: number;
	priv_cattime?: number;
	run_cating?: boolean;
	cat(data: T): Promise<boolean> | boolean;
}

/**
 * @class Watch extends Monitor
 */
export abstract class Watch<T = any> extends Monitor {
	private _cat: Map<string, {watch: WatchCat<T>, ok: boolean}> = new Map;
	private _msg?: MessagePost;

	constructor(interval = RUN_INTERVAL, maxDuration = -1) {
		super(interval, maxDuration);
	}

	setMessage(msg: MessagePost) {
		this._msg = msg;
	}

	abstract beforeCat(now: Number): Promise<T> | T;

	/**
	 * @func cat()
	 */
	async cat(force?: boolean) {
		var now = Date.now();
		var data = await this.beforeCat(now);
		// cats
		for (var [name,o] of this._cat) {
			let {watch:w,ok} = o;
			if (force || (now > (w.priv_cattime as number) + (w.cattime as number) * RUN_INTERVAL && !w.run_cating)) {
				(async ()=>{
					var _ok = false;
					try {
						w.priv_cattime = now;
						w.run_cating = true;
						_ok = await w.cat(data);
						(w.catcount as number)++;
					} catch(err) {
						console.error(err);
					} finally {
						w.run_cating = false;
					}
					if (_ok != ok) {
						o.ok = _ok;
						if (this._msg) {
							this._msg.post('WatchChange', {
								id: `${host}:${pid}:${name}`,
								host: host,
								pid: pid,
								name: name,
								status: ok,
							});
						}
					}
				})();
				// exec end
			}
		}
	}

	addWatch(cat: WatchCat) {
		var name = cat.name || cat.constructor.name;
		if (!this._cat.has(name)) {
			cat.catcount = 0;
			cat.cattime = cat.cattime || 1;
			cat.priv_cattime = 0;
			this._cat.set(name, {watch:cat, ok: true});
		}
	}

	delWatch(cat: WatchCat) {
		this._cat.delete(cat.name || cat.constructor.name);
	}

	run() {
		super.start(()=>this.cat());
	}

}

export class WatchDefault extends Watch<number> {

	beforeCat() {
		return 0;
	}

	run() {
		if (!this.running) {
			setTimeout(()=>super.run(), 5e3); // 5s
		}
	}

}

export default new WatchDefault();