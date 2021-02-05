/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import {getLocalNetworkHost} from 'somes/network_host';
import {Monitor} from 'somes/monitor';

const RUN_INTERVAL = 60 * 1000; // 60s
const host = getLocalNetworkHost()[0];
const pid = process.pid;

export interface WatchCat {
	catcount?: number;
	cattime?: number;
	priv_cattime?: number;
	run_cating?: boolean;
	cat(): Promise<boolean> | boolean;
}

/**
 * @class Watch extends Monitor
 */
class Watch extends Monitor {
	private m_cat: Map<string, {watch: WatchCat, ok: boolean}> = new Map;

	/**
	 * @func cat()
	 */
	cat() {
		var now = Date.now();
		// cats
		for (var [name,o] of this.m_cat) {
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
						import('./message').then((msg)=>msg.default.send('WatchStatusChange', {
							id: `${host}:${pid}:${name}`,
							host: host,
							pid: pid,
							name: name,
							status: ok,
						}));
					}
				})();
				// exec end
			}
		}
	}

	addWatch(cat: WatchCat) {
		var name = cat.constructor.name;
		if (!this.m_cat.has(name)) {
			cat.catcount = 0;
			cat.cattime = cat.cattime || 1;
			cat.priv_cattime = 0;
			this.m_cat.set(name, {watch:cat, ok: true});
		}
	}

	delWatch(cat: WatchCat) {
		this.m_cat.delete(cat.constructor.name);
	}

	run() {
		super.start(()=>{
			this.cat();
		});
	}
}

const watch = new Watch(RUN_INTERVAL, -1);

export default watch;

setTimeout(()=>watch.run(), 5e3); // 5s
