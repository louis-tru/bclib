/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-03-11
 */

import somes from 'somes';
import jsonb from 'somes/jsonb';
import uuid from 'somes/hash/uuid';
import {Notification} from 'somes/event';

// "@types/amqplib": "~0.8.0",
// import {Channel,ConfirmChannel,Connection,connect} from 'amqplib';

const amqplib = require('amqplib');

const connect = amqplib.connect;
type Connection = any;
type Channel = any;
type PromiseHooks = [(ch: Channel)=>void, (err: Error)=>void];

class AmqpChannel {
	private _host: QueueCenter;
	private _impl: Channel | null = null;
	private _name: string;
	private _creating_promise_hooks: PromiseHooks[] | null = null;
	private _consumeListener: { cb: (data: any, msg: any, uuid: string)=>void, opts: any; fields: any } | null = null;
	private _consumeMessage = new Map<string, any>();

	constructor(host: QueueCenter, name: string) {
		this._host = host;
		this._name = name;
	}

	private async _disconnectHandle() {
		var obj = this._consumeListener;
		while (obj && obj === this._consumeListener) {
			try {
				await this.consume(obj.cb, obj.opts); // reconsume
				break;
			} catch(err) {
				console.warn('AmqpChannel#_disconnectHandle', err);
			}
			await somes.sleep(1e3)
		}
	}

	private async _channelImpl() {
		var self = this;
		somes.assert(!self._impl);

		var conn = await self._host._connect();
		try {
			this._impl = await conn.createChannel();
			await this._impl.assertQueue(this._name, {durable: false});
		} catch(err) {
			this._impl = null;
			throw err;
		}

		this._impl.on('close', ()=>{
			if (this._impl) {
				this._impl = null;
				somes.sleep(100).then(()=>this._disconnectHandle());
			}
		});

		this._impl.on('error', ()=>{
			if (this._impl) {
				console.error('this._impl.error');
				this._impl.close();
			}
		});
	
		return this._impl;
	}
	
	private _channelRetry(retry = 5) {
		var self = this;
		var hooks: PromiseHooks[];
		this._channelImpl().then(ch=>{
			hooks = self._creating_promise_hooks as PromiseHooks[];
			self._creating_promise_hooks = null;
			hooks.forEach(([resolve])=>resolve(ch));
		})
		.catch(err=>{
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
		if (this._impl) {
			return Promise.resolve(this._impl);
		}
		if (!this._creating_promise_hooks) {
			this._creating_promise_hooks = [];
			this._channelRetry(5);
		}
		return new Promise<Channel>((resolve, reject)=>{
			(this._creating_promise_hooks as PromiseHooks[]).push([resolve, reject]);
		});
	}

	async send(data: any, opts?: any) {
		var ch = await this._channel();
		var _data = { data, __uuid: uuid() };
		var ok = ch.sendToQueue(this._name, Buffer.from(jsonb.binaryify(_data)), opts);
		return ok;
	}

	async consume(cb: (data: any, msg: any, uuid: string)=>any, opts?: any) {
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
				console.warn('AmqpChannel#consume#1', err);
				ch.nack(msg, false, false);
				return;
			}
			try {
				consumeMessage.set(uuid, msg);
				await cb(data, msg, uuid);
			} catch(err) {
				console.warn('AmqpChannel#consume#2', err);
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
			if (this._impl) {
				var ok = await this._impl.cancel(this._consumeListener.fields.consumerTag);
				return !!ok;
			}
			this._consumeListener = null;
		}
		return true;
	}

	async ack(message: any, allUpTo?: boolean) {
		var ch = await this._channel();
		var ok = await ch.ack(message, allUpTo);
	}

	async ackAll() {
		var ch = await this._channel();
		var ok = await ch.ackAll();
	}

	async nack(message: any, allUpTo?: boolean, requeue?: boolean) {
		var ch = await this._channel();
		var ok = await ch.nack(message, allUpTo, requeue);
	}

	async nackAll(requeue?: boolean) {
		var ch = await this._channel();
		var ok = await ch.nackAll(requeue);
	}

}

export class QueueCenter extends Notification {
	private _url: string;
	private _impl: Connection | null = null;
	private _channelObjs: Map<string, AmqpChannel>;

	constructor(url: string) {
		super();
		this._url = url;
		this._channelObjs = new Map();
	}

	async _connect() {
		if (!this._impl) {
			this._impl = await connect(this._url);
			this._impl.on('close', ()=>{
				this._impl = null;
			});
			this._impl.on('error', ()=>{
				console.error('this._connectRaw.error');
				if (this._impl) {
					this._impl.close();
					//this._impl = null;
				}
			});
		};
		return this._impl;
	}

	private channel(name: string = 'default') {
		var ch = this._channelObjs.get(name);
		if (!ch) {
			ch = new AmqpChannel(this, name);
			this._channelObjs.set(name, ch);
		}
		return ch;
	}

	// @overwrite:
	getNoticer(name: string) {
		var ch = this._channelObjs.get(name);
		if (!ch) {
			ch = new AmqpChannel(this, name);
			this._channelObjs.set(name, ch);
		}
		// return ch;
		if (!this.hasNoticer(name)) {
			//this.m_mqtt.subscribe(this.m_topic + '/' + name); // subscribe message
		}
		return super.getNoticer(name);
	}

	// @overwrite:
	trigger(event: string, data: any) {
		//this.publish(event, data);
	}

}