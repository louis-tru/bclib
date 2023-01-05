/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-19
 */

import somes from 'somes';
import errno from './errno';
import {WatchCat} from 'bclib/watch';
import db from './db';
import * as env from './env';
import bus from './message';

export const EventTaskComplete = 'TaskComplete';

export interface TaskData<Args = any> {
	id: number;//           int primary        key auto_increment, -- 主键id
	name: string;//         varchar (64)                 not null, -- 任务名称
	args: Args;//            json,                                  -- 执行参数
	data: any;
	step: number;//         int        default (0)       not null, -- 当前执行步骤
	stepTime: number;//     int          default (0)     not null, -- 当前执行步骤
	user: string; //        varchar (64) default ('')    not null, -- 与用户的关联,完成后可以通知到客户端
	state: number;//        int        default (0)       not null, -- 0进行中,1完成,2失败
	time: number;//         bigint                       not null,
}

function broadcastTaskComplete(task_id: number) {
	bus.post(EventTaskComplete, { task_id });
}

export interface TaskConstructor<T> {
	new(tasks: TaskData<T>): Task<T>;
}

export abstract class Task<T = any> {

	private _steps: ({func: (...args: any[])=>any, verify?: (data: any)=>Promise<any>, timeout: number})[] = [];

	readonly tasks: TaskData<T>;

	protected constructor(tasks: TaskData<T>) {
		this.tasks = tasks;
		this.exec(tasks.args);
	}

	abstract exec(args: T): void;

	get id() { return this.tasks.id; }

	step<T = any, Args = any>(
		func: (...args: Args[])=>Promise<T>,
		verify?: (data: any)=>Promise<any>,
		timeout?: number
	) {
		this._steps.push({ func, verify, timeout: timeout || (1800 * 1e3) }); // 30 Minutes
	}

	private complete() {
		broadcastTaskComplete(this.tasks.id);
	}

	async next(error?: any, data?: any): Promise<void> {

		// somes.assert(this.tasks.state == 0, errno.ERR_TASK_BEEN_CLOSED);
		if (this.tasks.state != 0) {
			console.warn(`ERR_TASK_BEEN_CLOSED`);
			return;
		}

		await somes.sleep(100);

		let {id, step} = this.tasks;
		if (error) {
			if (await db.update(`tasks`, { state: 2, data: { error: Error.new(error) } }, { id, state: 0 }) == 1) { /*fail*/
				this.complete();
			}
			return;
		}

		let throwError = async (tag: string, err: any)=>{
			console.warn(tag, err.message);
			let set = { data: { error: Error.new(err) }, state: 2 }
			if ( await db.update(`tasks`, set, { id, step: this.tasks.step, state: 0 }) == 1) {
				this.complete();
			}
		}

		// verify
		if (step > 0 && step <= this._steps.length) {
			let stepExec = this._steps[step - 1];
			if (stepExec.verify) {
				data = await stepExec.verify(data);
				if (data) {
					if (data instanceof Error) {
						await throwError('Task#next', data);
						return;
					}
				} else return;
			}
		}

		if (step < this._steps.length) {
			let stepExec = this._steps[step];
			let stepTime = stepExec.timeout ? stepExec.timeout + Date.now(): 0;

			let i = await db.update(`tasks`, { step: step + 1, stepTime }, { id, step, state: 0 });
			if ( i == 1) {
				this.tasks.step++;
				try {
					await stepExec.func(data);
				} catch (err: any) {
					await throwError('Task#next1', err);
				}
			}
		} else if (step == this._steps.length) { // complete
			if ( await db.update(`tasks`, { data: { data }, state: 1 }, { id, step, state: 0 }) == 1) {
				this.complete();
			}
		}
	}

	static async make<T = any>(this: TaskConstructor<T>, name: string, args: T, user?: string) {
		let Constructor = this as TaskConstructor<T>;
		// MekeDAO#Name
		somes.assert(!await db.selectOne(`tasks`, { name, state: 0 }), errno.ERR_TASK_ALREADY_EXISTS);

		// id           int primary        key auto_increment, -- 主键id
		// name         varchar (64)                 not null, -- 任务名称, MekeDAO#Name
		// method       varchar (1204)               not null, -- 执行任务的方法以及文件名
		// args         json,                                  -- 执行参数数据
		// data         json,                                  -- 成功或失败的数据 {data, error}
		// step         int          default (0)     not null, -- 当前执行步骤
		// stepTime     int          default (0)     not null, -- 当前执行步骤的超时时间,可用于执行超时检查
		// user         varchar (64) default ('')    not null, -- 与用户的关联,完成后可以通知到客户端
		// state        int          default (0)     not null, -- 0进行中,1完成,2失败
		// time         bigint                       not null,

		let task = await db.transaction(async function(db) {
			let id = await db.insert(`tasks`, {
				name, args: args || {}, state: 0, user, time: Date.now(), modify: Date.now()
			});
			let tasks = await db.selectOne<TaskData>(`tasks`, {id});
			return new Constructor(tasks!);
		});
		return task;
	}

	static async task<T = any>(this: TaskConstructor<T>, id: number) {
		let Constructor = this as TaskConstructor<T>;
		let tasks = await db.selectOne<TaskData>(`tasks`, {id});
		somes.assert(tasks, errno.ERR_TASK_NOT_EXISTS);
		return new Constructor(tasks!);
	}
}

export class TaskCenter implements WatchCat {

	async initialize(addWatch: (watch: WatchCat)=>void) {
		if (!env.workers || env.workers.id === 0) { // Main Worker
			addWatch(this);
		}
	}

	async cat() {
		// chech task timeout
		for (let task of await db.select<TaskData>(`tasks`, {state: 0})) {
			if (task.stepTime && task.stepTime < Date.now()) { // timeout
				let error = Error.new(errno.ERR_TASK_STEP_EXEC_TIMEOUIT);
				if (await db.update(`tasks`, { state: 2 /*fail*/, data: { error } }, { id: task.id, state: 0 }) == 1) {
					// 更新成功后，发送完成消息
					broadcastTaskComplete(task.id);
				}
			}
		}
		return true;
	}
}

export default new TaskCenter();