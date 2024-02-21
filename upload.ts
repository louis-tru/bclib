/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2024-02-21
 */

import cfg from './cfg';
import * as qn from './qn';
import {config as s3_config, S3} from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';
import errno from './errno';

if (cfg.s3) {
	s3_config.update({
		accessKeyId: cfg.s3.accessKeyId,
		secretAccessKey: cfg.s3.secretAccessKey,
	});
}

export const config: {
	prefix: string, all_prefix: string[]
} = cfg.qiniu || cfg.s3 || {prefix: '', all_prefix: []};

export const isQiniu = !!cfg.qiniu;

export interface State {
	key: string;
	fsize: number,//1698853,
	hash: string,//"FoXbQNzDzA8m0ie0V36eSdV1QAna",
}

// ----------------------- s3 -----------------------

export async function s3_exists(key: string): Promise<boolean> {
	let [s] = await s3_searchPrefix(key, 1);
	return !!s;
}

export async function s3_state(key: string): Promise<State> {
	let [s] = await s3_searchPrefix(key, 1);
	if (!s)
		throw Error.new(errno.ERR_QINIU_STATE_FILE_404);
	return s;
}

export function s3_searchPrefix(prefix: string, limit: number = 1): Promise<State[]> {
	return new Promise(function (resolve, reject) {
		let s3 = new S3();
		s3.listObjects({
			Bucket: cfg.s3!.bucket, Prefix: prefix, MaxKeys: limit
		}, function (err, res) {
			if (err){
				reject(Error.new(errno.ERR_S3_UPLOAD_ERR).ext({ prefix }));
			} else {
				resolve(res.Contents!.map(e=>{
					return {
						key: e.Key!,
						fsize: e.Size!,
						hash: e.ETag!,
					};
				}));
			}
		});
	});
}

export function s3_upload(src: string, dest?: string, mime?: string): Promise<string>{
	return new Promise<string>(function (resolve, reject) {
		let key = dest || path.basename(src);
		let s3 = new S3();
		let stream = fs.createReadStream(src);

		s3.putObject({
			Bucket: cfg.s3!.bucket,
			Key: key,
			Body: stream,
			ContentType: mime,
			ACL: 'public-read',
		}, function(err, data) {
			if (err) {
				reject(Error.new(errno.ERR_S3_UPLOAD_ERR).ext({ src }));
			} else {
				resolve(key);
			}
			stream.close();
		});
	});
}

// ----------------------- export -----------------------

export const exists = isQiniu ? qn.exists: s3_exists;
export const state: ((k:string)=>Promise<State>) = isQiniu ? qn.state: s3_state;
export const searchPrefix = isQiniu ? qn.searchPrefix: s3_searchPrefix;
export const upload = isQiniu ? qn.default: s3_upload;

export default upload;