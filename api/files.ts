/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

import paths from '../paths';
import {ViewController} from 'somes/ctr';
import request from 'somes/request';
import {Http2Sessions} from 'somes/http2';
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
import * as tls from 'tls';
import * as http2 from 'http2';
import {URL} from 'somes/path';

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

const sessions = new Http2Sessions();

export default class extends ViewController {

	static public = false;

	async res({ pathname }: { pathname: string }) {
		var ext = path.extname(pathname);
		var name = pathname.substring(0, pathname.length - ext.length);
		pathname = paths.res + '/' + name;
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
		var pathname = `${paths.res}/${basename}`;
		var save = `${pathname}${ext}`;
		var tmp = `${paths.tmp_res}/${basename}${ext}~`;

		if (await fs.exists(save) && (await fs.stat(save)).size) {
			try {
				mime = (await fs.readFile(`${pathname}.mime`)).toString('utf-8');
			} catch(err) {}
			return this.returnFile(save, mime);
		}
		await utils.scopeLock(`_mutex_files_read_${save}`, async ()=>{
			try {
				mime = (await wget(url, tmp)).mime;
			} catch(err: any) {
				if (err.statusCode != 416)
					throw err;
			}
			await fs.rename(tmp, save);
			await fs.writeFile(`${pathname}.mime`, mime);
		});

		this.returnFile(save, mime);
	}

	security(opts: {
		pathname: string, noCrypt?: boolean, sslVersion?: tls.SecureVersion, http2?: boolean
	}) {
		return this.http({...opts, crypto: !opts.noCrypt});
	}

	/**
	 * @dev http proxy
	 * */
	http({ pathname, crypto, sslVersion, http2 }: {
		pathname: string, crypto?: boolean, sslVersion?: tls.SecureVersion, http2?: boolean
	}) {
		if (http2) {
			return this.http2({pathname, sslVersion});
		}
		var url = buffer.from(pathname, 'base58').toString('utf-8');
		var isSSL = !!url.match(/^https:\/\//i);
		var lib = isSSL ? https: http;

		var uri = new path.URL(url);
		var hostname = uri.hostname;
		var port = Number(uri.port) || (isSSL ? 443: 80);
		var method = this.form ? 'POST': 'GET';

		var res = this.response;
		var {connection,host,port: _,..._headers} = this.headers;

		var headers: Dict = {
			'Host': uri.port ? hostname + ':' + port: hostname,
			'User-Agent': request.userAgent,
		};

		for (var i in _headers) {
			var j = i.replace(/((^|\-)[a-z])/g, function(a) {
				return a.toUpperCase();
			});
			headers[j] = _headers[i];
		}

		var opts: https.RequestOptions = {
			hostname,
			host: hostname,
			port,
			path: uri.path,
			method, 
			headers, 
			rejectUnauthorized: false,
			// minVersion: 'TLSv1.3',
		};

		if (sslVersion) {
			opts.minVersion = sslVersion;
		}

		var req = 
			lib.request(opts, (msg) => {
				if (crypto) {
					msg.pipe(new SecurityEncryption(msg, res));
				} else {
					res.writeHead(msg.statusCode as number, msg.headers);
					msg.pipe(res);
				}
			})
			.on('abort', ()=>res.destroy())
			.on('error', ()=>res.destroy())
			.on('timeout', ()=>res.destroy());

		if (this.form) {
			req.end(JSON.stringify(this.form.fields));
		} else {
			req.end();
		}

		this.markCompleteResponse();
	}

	http2({pathname, sslVersion}: { pathname: string, sslVersion?: tls.SecureVersion }) {
		var url = buffer.from(pathname, 'base58').toString('utf-8');
		var session = sessions.session(url, { minSsl: sslVersion });
		var uri = new URL(url);
		var method = this.form ? 'POST': 'GET';

		var res = this.response;
		var {connection,host,Host,Accept,port: _,..._headers} = this.headers;
		delete _headers['User-Agent'];

		var headers: http2.OutgoingHttpHeaders = {
			':path': uri.path,
			':scheme': 'https',
			':authority': uri.hostname,
			':method': method || 'GET',
			'user-agent': request.userAgent,
		};

		for (var i in headers) {
			var j = i.replace(/((^|\-)[a-z])/g, function(a) {
				return a.toLowerCase();
			});
			headers[j] = _headers[i];
		}

		var req = session.request(headers, {exclusive: true, weight: 220/*, endStream: true*/});
		var statusCode = 0;
		var responseHeaders: Dict = {};
		var ok = false;

		var Err = (e?: Error)=>{
			if (!ok) {
				ok = true;
				session.removeListener('error', Err);
				session.removeListener('close', Err);
				res.destroy();
			}
		};
		var Ok = ()=>{
			if (!ok) {
				ok = true;
				session.removeListener('error', Err);
				session.removeListener('close', Err);
			}
		};

		session.on('error', Err);
		session.on('close', Err);
		req
			.on('aborted', Err)
			.on('error', Err)
			.on('timeout', Err)
			.on('end', Ok)
			.on('response', (headers)=>
			{
				for (var [k,v] of Object.entries(headers)) {
					if (k[0] != ':')
						responseHeaders[k] = v;
				}
				statusCode = headers[':status'] as number;
				res.writeHead(statusCode as number, responseHeaders);
				req.pipe(res);
			});

		if (this.form) {
			req.end(JSON.stringify(this.form.fields));
		} else {
			req.end();
		}

		this.markCompleteResponse();
	}

};
