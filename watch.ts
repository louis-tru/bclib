/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {getLocalNetworkHost} from 'somes/network_host';
import {Monitor} from 'somes/monitor';
import {NotificationCenter} from 'somes/mbus';

const RUN_INTERVAL = 60 * 1000; // 60s
const [host] = getLocalNetworkHost();
const pid = process.pid;

export interface WatchCat {
	catcount?: number;
	cattime?: number;
	priv_cattime?: number;
	run_cating?: boolean;
	cat(): Promise<boolean> | boolean;
}

var _defauleWatch: Watch | undefined;

/**
 * @class Watch extends Monitor
 */
export class Watch extends Monitor {
	private _cat: Map<string, {watch: WatchCat, ok: boolean}> = new Map;
	private _mbus?: NotificationCenter;

	constructor(interval = RUN_INTERVAL, maxDuration = -1) {
		super(interval, maxDuration);
	}

	seBus(bus: NotificationCenter) {
		this._mbus = bus;
	}

	/**
	 * @func cat()
	 */
	cat() {
		var now = Date.now();
		// cats
		for (var [name,o] of this._cat) {
			var {watch:w,ok} = o;
			if (now > (w.priv_cattime as number) + (w.cattime as number) * RUN_INTERVAL && !w.run_cating) {
				(async ()=>{
					var _ok = false;
					try {
						w.priv_cattime = now;
						w.run_cating = true;
						_ok = await w.cat();
						(w.catcount as number)++;
					} catch(err) {
						console.error(err);
					} finally {
						w.run_cating = false;
					}
					if (_ok != ok) {
						o.ok = _ok;
						if (this._mbus) {
							this._mbus.trigger('WatchStatusChange', {
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
		var name = cat.constructor.name;
		if (!this._cat.has(name)) {
			cat.catcount = 0;
			cat.cattime = cat.cattime || 1;
			cat.priv_cattime = 0;
			this._cat.set(name, {watch:cat, ok: true});
		}
	}

	delWatch(cat: WatchCat) {
		this._cat.delete(cat.constructor.name);
	}

	run() {
		super.start(()=>{
			this.cat();
		});
	}

	static get defauleWatch() {
		if (!_defauleWatch) {
			_defauleWatch = new Watch();
		}
		return _defauleWatch;
	}

}

export default {

	addWatch(cat: WatchCat) {
		return Watch.defauleWatch.addWatch(cat);
	},

	delWatch(cat: WatchCat) {
		return Watch.defauleWatch.delWatch(cat);
	},

	runDefault() {
		if (!Watch.defauleWatch.running) {
			setTimeout(()=>Watch.defauleWatch.run(), 5e3); // 5s
		}
	},
}