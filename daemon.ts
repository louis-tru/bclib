/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-01-25
 */

import somes from 'somes';
import {spawn, SpawnPromise} from 'somes/syscall';
import localStorage from './storage';
import * as child_process from 'child_process';

export class Daemon {
	private _id = 0;
	private runHandle: SpawnPromise | null = null;
	private _name: string;

	get process() {
		somes.assert(this.runHandle, 'child process no start');
		return (this.runHandle as any).process as child_process.ChildProcess;
	}

	get id() {
		return this._id;
	}

	constructor(name: string) {
		this._name = name;
	}

	protected checkStartComplete(d: Buffer, s: string) {
		return true;
	}

	async run(cmd: string, args: any[], env?: Dict, start?: (id: number)=>void) {
		if (this.id) return start && start(this.id);
		var id = this._id = somes.getId();
		var cb: ((id: number)=>void) | undefined = start;
		var self = this;

		function onData(e: Buffer) {
			if (cb) {
				var r = e.toString('utf8');
				if (self.checkStartComplete(e, r)) {
					cb(self._id);
					cb = undefined;
				}
			}
			return '';
		}
		do {
			try {
				var oldpid = await localStorage.get(`${this._name}_pid`, 0);
				if (oldpid) {
					if (process.platform == 'win32') {
						await spawn('taskkill', ['/pid', oldpid]);
					} else {
						await spawn('kill', [oldpid]);
					}
				}
				this.runHandle = spawn(cmd, args, { onData: onData, onError: onData, env });
				
				await localStorage.set(`${this._name}_pid`, this.runHandle.process.pid);
				var r = await this.runHandle;
				console.log(r);
			} catch(err: any) {
				console.warn('Daemon#run', err);
			}
			await somes.sleep(5e3); // 5s

		} while(this.id == id);
	}

	start(cmd: string, args: any[], env?: Dict) {
		return new Promise<number>(r=>this.run(cmd, args, env, r));
	}
	
	stop(signal?: number) {
		this._id = 0;
		if (this.runHandle && this.runHandle.process) {
			this.runHandle.process.kill(signal);
		}
	}
	
}
