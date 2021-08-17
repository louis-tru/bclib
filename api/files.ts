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

export default class extends ViewController {

	requestAuth() {
		return this.request.method == 'GET';
	}

	async res({ pathname }: { pathname: string }) {
		pathname = paths.tmp_res_dir + '/' + pathname; 
		if (await fs.exists(`${pathname}.mime`)) {
			this.returnFile(pathname, await fs.readFile(`${pathname}.mime`) + '');
		} else {
			this.returnFile(pathname);
		}
	}

	async get({ pathname }: { pathname: string }) {

		var url = decodeURIComponent(pathname);
		if (!url.match(/https?:\/\//i)) {
			return this.returnFile(pathname);
		}
		var mime = '';
		var extname = path.extname(url);
		var save = `${paths.tmp_res_dir}/${utils.hash(url)}${extname}`;
		if (await fs.exists(save) && (await fs.stat(save)).size) {
			try {
				if (!extname)
					mime = (await fs.readFile(`${save}.mime`)) + '';
			} catch(err) {}
			return this.returnFile(save, mime);
		}

		await utils.scopeLock(`_mutex_files_res_${save}`, async ()=>{
			try {
				mime = (await wget(url, `${save}~`)).mime;
			} catch(err) {
				if (err.statusCode != 416)
					throw err;
			}
			await fs.rename(`${save}~`, save);
			if (!extname && mime)
				await fs.writeFile(`${save}.mime`, mime);
		});

		this.returnFile(save, mime);
	}

};
