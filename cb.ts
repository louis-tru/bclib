/**
 * @copyright © 2020 Copyright ccl
 * @date 2023-08-04
 */

import utils from 'somes';
import {Signer} from 'somes/request';
import buffer from 'somes/buffer';
import db from './db';
import keys from './keys+';
import {post} from './request';
import {WatchCat} from './watch';
import {MysqlTools} from 'somes/mysql';
import * as crypto_tx from 'crypto-tx';
import {scopeLock} from './atomic_lock'

class SignerIMPL implements Signer {
	async sign(path: string, data: string) {
		var st = String(Date.now());
		var key = 'a4dd53f2fefde37c07ac4824cf7086439633e1a357daacc3aaa16418275a9e48';
		var hash = crypto_tx.keccak(path + data + st + key).data;
		var signature = await keys.impl.sign(buffer.from(hash), keys.impl.defauleAddress);
		var sign = buffer.concat([signature.signature, [signature.recovery]]).toString('base64');
		return { st, sign };
	}
}

class CallbackTask implements WatchCat {
	cattime = 1;
	signer = new SignerIMPL();

	private async lockDataState(table: string, id: number, lockTimeout = 10 * 60 * 1e3/*default 10m*/, cb: ()=>any) {
		var active = Date.now() + utils.random(0, 1e3);
		var [r] = await db.exec(
			`update ${table} set state=1,active=${active}
					where id=${id} and (state=0 or (state=1 and active<${active-lockTimeout}))
		`);
		if (db instanceof MysqlTools) {
			if (!r || !r.affectedRows) // first lock failed
				return
		}
		// safe global lock
		await scopeLock('callbackTask_'+ id, async ()=>{
			var it = await db.selectOne(table, { id, state: 1, active });
			if (it) {
				await cb();
			}
		});
	}

	private async exec(id: number, data: any, url: string, retry: number) {
		var timeout = Math.min(3600, Math.pow(1.5, retry)) * 1e3; // max 3600s
			// Multi worker lock
		await this.lockDataState('callback_url', id, timeout, async ()=>{
			var r = await post(url, { params: data, urlencoded: false, signer: this.signer });
			if (r.statusCode == 200) {
				await db.delete('callback_url', {id});
			} else {
				await db.update('callback_url', { retry: retry+1, state: retry < 144 ? 1: 3/*丢弃*/ }, { id });
			}
		});
	}

	async add(data: any, url: string) {
		try {
			utils.assert(url.match(/^https?:\/\/.+/i), 'callbackURI uri invalid');
			var id = await db.insert('callback_url', { url, data: JSON.stringify(data) }) as number;
			await this.exec(id, data, url, 0); // execute immediately
		} catch(err) {
			console.warn('#CallbackTask.add', err);
		}
	}

	async cat() {
		let items = await db.query(`select * from callback_url where state=0 or state=1`);
		for (let item of items) {
			try {
			await this.exec(item.id, JSON.parse(item.data), item.url, item.retry);
			} catch(err) {
				console.warn('#CallbackTask.cat', err);
			}
		}
		return true;
	}
}

export const callbackTask = new CallbackTask();