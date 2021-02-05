/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-08
 */

import somes from 'somes';
import jsonb from 'somes/jsonb';
import uuid from 'somes/hash/uuid';

const amqplib = require('amqplib');

type AmqplibRaw = any;
type AmqplibChannelRaw = any;
type PromiseHooks = [(ch: AmqplibChannelRaw)=>void, (err: Error)=>void];

export class AmqpConnect {
	private _connectRaw: AmqplibRaw | null = null;
	private _url: string;

	constructor(url: string) {
		this._url = url;
	}

	async _inlConnect() {
		if (!this._connectRaw) {
			this._connectRaw = await amqplib.connect(this._url);
			this._connectRaw.on('close', ()=>{
				this._connectRaw = null;
			});
			this._connectRaw.on('error', ()=>{
				console.error('this._connectRaw.error');
				this._connectRaw.close();
			});
		};
		return this._connectRaw;
	}

}

/**
 * @class AmqpChannel
 */
export class AmqpChannel {

	private _connectObj: AmqpConnect;
	private _channelRaw: AmqplibChannelRaw | null = null;
	private _name: string;
	private _creating_promise_hooks: PromiseHooks[] | null = null;
	private _consumeListener: { cb: (data: any, msg: any, uuid: string)=>void, opts: any; fields: any } | null = null;
	private _consumeMessage = new Map<string, any>();

	private async _disconnectHandle() {
		var obj = this._consumeListener;
		while (obj && obj === this._consumeListener) {
			try {
				await this.consume(obj.cb, obj.opts); // reconsume
				break;
			} catch(err) {
				console.log('_disconnectHandle', err);
			}
			await somes.sleep(1e3)
		}
	}

	private _connect() {
		return this._connectObj._inlConnect();
	}

	private async _channelImpl() {
		var self = this;
		somes.assert(!self._channelRaw);

		var conn = await self._connect();
		try {
			this._channelRaw = await conn.createChannel();
			await this._channelRaw.assertQueue(this._name, {durable: false});
		} catch(err) {
			this._channelRaw = null;
			throw err;
		}

		this._channelRaw.on('close', ()=>{
			if (this._channelRaw) {
				this._channelRaw = null;
				somes.sleep(100).then(()=>this._disconnectHandle());
			}
		});
		this._channelRaw.on('error', ()=>{
			console.error('this._channelRaw.error');
			this._channelRaw.close();
		});
	
		return this._channelRaw;
	}
	
	private _channelRetry(retry = 5) {
		var self = this;
		var hooks: PromiseHooks[];
		this._channelImpl().then(ch=>{
			hooks = self._creating_promise_hooks as PromiseHooks[];
			self._creating_promise_hooks = null;
			hooks.forEach(([resolve])=>resolve(ch));
		}).catch(err=>{
			if (--retry <= 0) {
				hooks = self._creating_promise_hooks as PromiseHooks[];
				self._creating_promise_hooks = null;
				hooks.forEach(([,reject])=>reject(err));
				console.error(`----------- Amqp channel Retry ${this._name} err -----------`);
			} else {
				console.error(`----------- Amqp channel Retry ${this._name} ${retry} -----------`);
				setTimeout(()=>self._channelRetry(retry), 1e3);
			}
		});
	}

	private _channel() {
		if (this._channelRaw) {
			return this._channelRaw;
		}

		if (!this._creating_promise_hooks) {
			this._creating_promise_hooks = [];
			this._channelRetry(5);
		}

		return new Promise((resolve, reject)=>{
			if (this._channelRaw) {
				resolve(this._channelRaw);
			} else {
				(this._creating_promise_hooks as PromiseHooks[]).push([resolve, reject]);
			}
		});
	}

	get name() {
		return this._name;
	}

	constructor(connect: AmqpConnect, name: string) {
		this._connectObj = connect;
		this._name = name;
	}

	async send(data: any, opts?: any) {
		var ch = await this._channel();
		var _data = { data, __uuid: uuid() };
		var ok = await ch.sendToQueue(this._name, Buffer.from(jsonb.binaryify(_data)), opts);
		return ok as boolean;
	}

	async consume(cb: (data: any, msg: any, uuid: string)=>void, opts?: any) {
		var ch = await this._channel();
		var consumeMessage = this._consumeMessage;
		var fields = await ch.consume(this._name, async function(msg: any) {
			var data: any, uuid: any;
			try {
				var {data, __uuid: uuid } = jsonb.parse(msg.content);
				if (consumeMessage.has(uuid)) {
					Object.assign(consumeMessage.get(uuid), msg);
					return;
				}
			} catch(err) {
				console.error(err);
				ch.nack(msg, false, false);
				return;
			}
			try {
				consumeMessage.set(uuid, msg);
				await cb(data, msg, uuid);
			} catch(err) {
				console.error(err);
				ch.nack(msg, false, false);
			} finally {
				consumeMessage.delete(uuid);
			}
		}, opts);
		this._consumeListener = { cb, opts, fields };
		return fields; // as boolean;
	}

	async cancel() {
		if (this._consumeListener) {
			if (this._channelRaw) {
				var ok = await this._channelRaw.cancel(this._consumeListener.fields.consumerTag);
			}
			this._consumeListener = null;
			return ok as boolean;
		}
		return true;
	}

	async ack(message: any, allUpTo?: boolean) {
		var ch = await this._channel();
		var ok = await ch.ack(message, allUpTo);
		return ok as boolean;
	};

	async ackAll() {
		var ch = await this._channel();
		var ok = await ch.ackAll();
		return ok;
	};

	async nack(message: any, allUpTo?: boolean, requeue?: boolean) {
		var ch = await this._channel();
		var ok = await ch.nack(message, allUpTo, requeue);
		return ok as boolean;
	};

	async nackAll(requeue?: boolean) {
		var ch = await this._channel();
		var ok = await ch.nackAll(requeue);
		return ok as boolean;
	};

}

export class AmqpClient {
	private _connectObj: AmqpConnect;
	private _channelObjs: Map<string, AmqpChannel>;

	get connect() {
		return this._connectObj;
	}

	constructor(url: string) {
		this._connectObj = new AmqpConnect(url);
		this._channelObjs = new Map();
	}

	channel(name: string = 'default') {
		var ch = this._channelObjs.get(name);
		if (!ch) {
			ch = new AmqpChannel(this.connect, name);
			this._channelObjs.set(name, ch);
		}
		return ch;
	}

}