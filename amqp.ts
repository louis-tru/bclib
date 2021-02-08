/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-08
 */

import somes from 'somes';
import { AmqpClient } from './amqp_cli';
import errno from './errno';

export class Amqp {

	private _amqp_cfg = 'amqp://127.0.0.1';
	private _handlesDir = '.';
	private _amqp?: AmqpClient;

	writeErrorDiscardList(data: any) {
		console.error('WriteErrorDiscardList', data);
	}

	get amqp() {
		if (!this._amqp) {
			this._amqp = new AmqpClient(this._amqp_cfg);
		}
		return this._amqp;
	}

	get defaultChannel() {
		return this.amqp.channel('default');
	}

	channel(name: string = 'default') {
		return this.amqp.channel(name);
	}

	private initConsumer() {
		return this.amqp.channel().consume(async (data, msg)=>{
			try {
				var fn_str = data.fn as string;
				var [type, name] = fn_str.split('.');
				var handle = await import(`${this._handlesDir}/${type}`);
				somes.assert(handle, errno.ERR_METHOD_NOT_FOUND);
				var fn = handle[name];
				somes.assert(fn, errno.ERR_METHOD_NOT_FOUND);
				await fn.call(handle, data.args);
			} catch(err) {
				err = Error.new(err);
				console.error(err);
				
				var no_requeue =
					err.code == 'INVALID_ARGUMENT' ||
					err.errno == errno.ERR_METHOD_NOT_FOUND[0];
				if (err.errno == errno.ERR_UNKNOWN_ERROR[0]) { // discard
					no_requeue = true;
					this.writeErrorDiscardList(data);
				}
				await somes.sleep(5e2);
				return await this.amqp.channel().nack(msg, false, !no_requeue);
			}
			await this.amqp.channel().ack(msg);
			// this.amqp.channel().nackAll(false);
		});
	}
	
	async initialize(amqp_cfg: string, handlesDir: string = './amqp_consumer') {
		this._amqp_cfg = amqp_cfg || 'amqp://127.0.0.1';
		this._handlesDir = handlesDir;
		while(true) {
			try {
				await this.initConsumer();
				break;
			} catch(err) {}
		}
	}
}