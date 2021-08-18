/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import paths from '../paths';
import {ViewController} from 'somes/ctr';
import utils from 'somes';
import wget from 'somes/wget';
import * as fs from 'somes/fs2';
import path from 'somes/path';
import hash from 'somes/hash';
import * as http from 'http';
import * as https from 'https';
import buffer, {IBuffer} from 'somes/buffer';
import * as events from 'events';
import cfg from '../cfg';
import * as crypto from 'crypto';

class SecurityEncryption extends events.EventEmitter implements NodeJS.WritableStream {
	private _res: http.ServerResponse;
	private _cipher: crypto.Cipher;
	get writable() { return  this._res.writable };
	constructor(msg: http.IncomingMessage, res: http.ServerResponse, key?: IBuffer) {
		super();
		this._res = res;
		this._cipher = crypto.createCipheriv('aes-256-cbc', 
			key || buffer.from(cfg.filesSecurityKey.slice(2), 'hex'), 
			buffer.from(cfg.filesSecurityVi.slice(2), 'hex')
		);
		delete msg.headers['content-length'];
		res.writeHead(msg.statusCode as number, msg.headers);
		res
			.on('close', ()=>this.emit('close'))
			.on('finish', ()=>this.emit('finish'))
			.on('drain', ()=>this.emit('drain'))
			.on('error', (e)=>this.emit('error', e))
			.on('unpipe', (e)=>this.emit('unpipe', e));
		msg.on('error', ()=>this._res.destroy());
	}
	write(arg: any, ...args: any[]): boolean {
		return this._res.write(this._cipher.update(arg), ...args);
	}
	end(arg: any, ...args: any[]): void {
		if (Buffer.isBuffer(arg)) {
			this._res.end(Buffer.concat([this._cipher.update(arg), this._cipher.final()]), ...args);
		} else {
			this._res.end(this._cipher.final(), arg, ...args);
		}
	}
}

export default class extends ViewController {

	requestAuth() {
		return this.request.method == 'GET';
	}

	async res({ pathname }: { pathname: string }) {
		var ext = path.extname(pathname);
		var name = pathname.substr(0, pathname.length - ext.length);
		pathname = paths.tmp_res_dir + '/' + name;
		if (await fs.exists(`${pathname}.mime`)) {
			this.returnFile(pathname + ext, await fs.readFile(`${pathname}.mime`) + '');
		} else {
			this.returnFile(pathname + ext);
		}
	}

	async get({ pathname }: { pathname: string }) {
		var url = decodeURIComponent(pathname);
		if (!url.match(/https?:\/\//i)) {
			return this.returnFile(pathname);
		}
		var mime = '';
		var ext = path.extname(url);
		var basename = hash.md5(url).toString('hex');
		var pathname = `${paths.tmp_res_dir}/${basename}`;
		var save = `${pathname}${ext}`;

		if (await fs.exists(save) && (await fs.stat(save)).size) {
			try {
				mime = (await fs.readFile(`${pathname}.mime`)).toString('utf-8');
			} catch(err) {}
			return this.returnFile(save, mime);
		}
		await utils.scopeLock(`_mutex_files_read_${save}`, async ()=>{
			try {
				mime = (await wget(url, `${save}~`)).mime;
			} catch(err) {
				if (err.statusCode != 416)
					throw err;
			}
			await fs.rename(`${save}~`, save);
			await fs.writeFile(`${pathname}.mime`, mime);
		});

		this.returnFile(save, mime);
	}

	security({ pathname, noCrypt }: { pathname: string, noCrypt?: boolean }) {
		var url = buffer.from(pathname, 'base58').toString('utf-8');
		var isSSL = !!url.match(/^https:\/\//i);
		var lib = isSSL ? https: http;
		this.markCompleteResponse();

		var res = this.response;
		var {connection,host,port,...headers} = this.headers;
		var opts = { method: 'GET', headers, rejectUnauthorized: false };

		lib.request(url, opts, (msg) => {
			if (noCrypt) {
				res.writeHead(msg.statusCode as number, msg.headers);
				msg.pipe(res);
			} else {
				msg.pipe(new SecurityEncryption(msg, res));
			}
		})
		.on('abort', ()=>res.destroy())
		.on('error', ()=>res.destroy())
		.on('timeout', ()=>res.destroy())
		.end();
	}

};
