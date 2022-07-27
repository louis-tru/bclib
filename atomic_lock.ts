/**
 * @copyright © 2022 Copyright dphone.com
 * @date 2022-07-27
 */

// 分布式原子锁服务

import somes from 'somes';
import paths from './paths';
import {ServerIMPL} from 'somes/server';
import service from 'somes/service';
import {WSService} from 'somes/ws/service';
import {WSConversation, WSClient} from 'somes/ws/cli';
import {ConversationBasic} from 'somes/ws/_conv';
import errno from './errno';
import {List} from 'somes/event';
import {workers} from './env';
import path from 'somes/path';
import cfg from './cfg';

var _server: LockServer | null = null;
var _client: WSClient | null = null;

class LockServer extends ServerIMPL {
	private _scopeLockQueue = new Map<any, List<{lockOk: ()=>void, waitUnlock: ()=>Promise<void>}>>();

	constructor(port: number, host: string) {
		super({
			temp: `${paths.var}/temp`,
			root: `${__dirname}/../../public`,
			port: port,
			host: host,
			printLog: true,
			router: [] as any[],
			timeout: 180 * 1e3, // 180s
			formHash: 'sha256',
		});

		service.set('lock', LockService);
	}

	private async lockDequeue(mutex: any): Promise<void> {
		let queue = this._scopeLockQueue.get(mutex)!;
		let item = queue.first;
		while( item ) {
			let val = item.value;
			val.lockOk();
			await val.waitUnlock();
			item = item.next;
		}
		this._scopeLockQueue.delete(mutex);
	}

	lock(conv: ConversationBasic, mutex: string) {
		somes.assert(mutex, '#LockServer#scopeLock Bad argument');
		return new Promise<void>((lockOk)=>{

			let id = `_unlock_${mutex}`;
			let unlockOk: (()=>void) | null = null;
			//let timeout: any;
			let isUnlock = false;

			function unlock() {debugger
				isUnlock = true;
				delete (conv as any)[id];
				conv.onClose.off(id);
				if (unlockOk) {
					unlockOk();
					//clearTimeout(timeout);
				}
			}

			function waitUnlock() {debugger
				if (isUnlock) {
					return Promise.resolve();
				} else {
					//timeout = setTimeout(unlock, 180 * 1e3); // 180s
					return new Promise<void>(r=>(unlockOk = r));
				}
			}

			conv.onClose.on(unlock, id);
			(conv as any)[id] = unlock;

			if (this._scopeLockQueue.has(mutex)) {
				this._scopeLockQueue.get(mutex)!.push({lockOk, waitUnlock});
			} else {
				this._scopeLockQueue.set(mutex, new List<any>().push({lockOk, waitUnlock}).host!);
				this.lockDequeue(mutex); // dequeue
			}
		});
	}

	unlock(conv: ConversationBasic, mutex: string) {
		let unlock = (conv as any)[`_unlock_${mutex}`];
		if (unlock) {
			unlock();
		}
	}

	async start() {
		if (!this.isRun) {
			await super.start();
		}
	}
}

class LockService extends WSService {
	initialize() {
		/* noop */
	}
	lock({hash}: {hash: string}) {
		return (this.server as LockServer).lock(this.conv, hash);
	}
	unlock({hash}: {hash: string}) {
		return (this.server as LockServer).unlock(this.conv, hash);
	}
}

export async function startServer(port = 9801, host = '127.0.0.1') {
	if (!_server)
		_server = new LockServer(port, host);
	await _server.start();
}

export async function initializeClient(url = 'http://127.0.0.1:9801/') {
	somes.assert(!_client, errno.ERR_ATOMIC_LOCK_CLIENT_INITIALIZE);
	let conv = new WSConversation(url);
	conv.onClose.on(()=>console.error('Atomic lock, Connection accidental disconnection'));
	conv.keepAliveTime = 5e3; // 5s;
	conv.autoReconnect = 50; // 50ms
	_client = new WSClient('lock', conv);
	await _client.call('initialize');
}

export async function scopeLock<R>(mutex: any, cb: ()=>Promise<R>|R): Promise<R> {
	somes.assert(_client, errno.ERR_ATOMIC_LOCK_CLIENT_NOT_INITIALIZE);
	let cli = _client!;
	let hash = somes.hash(mutex);
	try {
		await cli.call('lock', {hash});
		let r = await cb();
		cli.call('unlock', {hash});
		return r;
	} catch(err) {
		cli.call('unlock', {hash});
		throw err;
	}
}

export async function initialize() {
	let url = new path.URL(cfg.atomicLock || 'http://127.0.0.1:9801/');
	if (!workers || workers.id == 0) {
		await startServer(Number(url.port || 9801), url.hostname); // init server
	}
	await initializeClient(url.href); // init client
}
