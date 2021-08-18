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

	get({ pathname }: { pathname: string }) {
		return this._read(pathname, true);
	}

	read({ pathname }: { pathname: string }) {
		return this._read(pathname);
	}

	private async _read(pathname: string, cache?: boolean) {

		var url = decodeURIComponent(pathname);
		if (!url.match(/https?:\/\//i)) {
			return this.returnFile(pathname);
		}

		var mime = '';
		var ext = path.extname(url);
		var basename = hash.md5(url).toString('hex');
		var pathname = `${paths.tmp_res_dir}/${basename}`;
		var save = `${pathname}${ext}`;

		if (cache) {
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
		} else {
			var isSSL = !!url.match(/^https:\/\//i);
			var lib = isSSL ? https: http;
			this.markCompleteResponse();

			var headers = {...this.headers};
			delete headers['connection'];

			lib.request(url, {
				method: 'GET', headers, rejectUnauthorized: false,
			}).pipe(this.response).end();
		}
	}

};
