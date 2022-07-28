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
import uuid from 'somes/hash/uuid';

var _server: LockServer | null = null;
var _client: WSClient | null = null;

class LockServer extends ServerIMPL {
	private _scopeLockQueue = new Map<string, List<{ lockOk: (id: string)=>void, waitUnlock: ()=>Promise<void>, id: string }>>();
	private _locks = new Map<string, ()=>void>();

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
			val.lockOk(val.id);
			await val.waitUnlock();
			item = item.next;
		}
		this._scopeLockQueue.delete(mutex);
	}

	lock(conv: ConversationBasic, mutex: string): Promise<string> {
		somes.assert(mutex, '#LockServer#scopeLock Bad argument');
		return new Promise<string>((lockOk)=>{
			let self = this;
			let id = uuid();
			let unlockOk = ()=>{};
			let timeout: any;
			let isUnlock = false;

			function unlock() {
				isUnlock = true;
				self._locks.delete(id);
				conv.onClose.off(id);
				clearTimeout(timeout);
				unlockOk();
			}

			function waitUnlock() {
				if (isUnlock) {
					return Promise.resolve();
				} else {
					timeout = setTimeout(unlock, 180 * 1e3); // 180s
					return new Promise<void>(r=>(unlockOk = r));
				}
			}

			conv.onClose.on(unlock, id);
			this._locks.set(id, unlock);

			if (this._scopeLockQueue.has(mutex)) {
				this._scopeLockQueue.get(mutex)!.push({lockOk, waitUnlock, id});
			} else {
				this._scopeLockQueue.set(mutex, new List<any>().push({lockOk, waitUnlock, id}).host!);
				this.lockDequeue(mutex); // dequeue
			}
		});
	}

	unlock(id: string) {
		let unlock = this._locks.get(id);
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
	initialize() {``
		/* noop */
	}
	lock({hash}: {hash: string}) {
		return (this.server as LockServer).lock(this.conv, hash);
	}
	unlock({id}: {id: string}) {
		return (this.server as LockServer).unlock(id);
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
	conv.keepAliveTime = 5e4; // 50s;
	conv.autoReconnect = 50; // 50ms
	_client = new WSClient('lock', conv);
	await _client.call('initialize');
}

export async function scopeLock<R>(mutex: any, cb: ()=>Promise<R>|R): Promise<R> {
	somes.assert(_client, errno.ERR_ATOMIC_LOCK_CLIENT_NOT_INITIALIZE);
	let cli = _client!;
	let hash = somes.hash(mutex);
	let id = 0;
	try {
		id = await cli.call('lock', {hash});
		return await cb();
	} finally {
		if (id) {
			cli.call('unlock', {id});
		}
	}
}

export async function initialize() {
	let url = new path.URL(cfg.atomicLock || 'http://127.0.0.1:9801/');
	if (!workers || workers.id == 0) {
		await startServer(Number(url.port || 9801), url.hostname); // init server
	}
	await initializeClient(url.href); // init client
}
