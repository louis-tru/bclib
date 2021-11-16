/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-09-14
 */

import * as qiniu from 'qiniu';
import cfg from './cfg';
import * as path from 'path';
import errno from './errno';
import somes from 'somes';
import * as fs from 'fs';

export function config() {
	var config = new qiniu.conf.Config() as qiniu.conf.ConfigOptions;
	// 空间对应的机房
	var spaces: Dict = {
		huadong: qiniu.zone.Zone_z0,
		huabei: qiniu.zone.Zone_z1,
		huanan: qiniu.zone.Zone_z2,
		beimei: qiniu.zone.Zone_na0,
		southeast_asia: qiniu.zone.Zone_as0,
	}
	var zone = cfg.qiniu ? spaces[cfg.qiniu.zone as any]: null;
	if (zone)
		config.zone = zone;
	// 是否使用https域名
	//config.useHttpsDomain = true;
	// 上传是否使用cdn加速
	config.useCdnDomain = true;

	return config;
}

export function uploadToken() {
	somes.assert(cfg.qiniu, errno.ERR_NO_QINIU_CONFIG);
	if (!cfg.qiniu) 
		throw 'err';
	var scope = cfg.qiniu.scope;
	var mac = new qiniu.auth.digest.Mac(cfg.qiniu.accessKey, cfg.qiniu.secretKey);
	var putPolicy = new qiniu.rs.PutPolicy({ scope });
	var token = putPolicy.uploadToken(mac);
	return {scope, mac, token};
}

export interface State {
	fsize: number,//1698853,
	hash: string,//"FoXbQNzDzA8m0ie0V36eSdV1QAna",
	key: string;
	md5: string,//"c41a413301d6d98fd2850ff41833b416",
	mimeType: string,//"image/jpeg",
	putTime: number,//16316781226417224,
	type: number,//0
	status: number;
}

export async function exists(key: string) {
	try {
		var stat = await state(key);
	} catch(err: any) {
		if (err.errno == errno.ERR_QINIU_STATE_FILE_404[0]) {
			return null;
		}
		throw err;
	}
	return stat;
}

export function searchPrefix(prefix: string, limit?: number) {
	var {mac, scope} = uploadToken();
	var bucket = new qiniu.rs.BucketManager(mac, config());

	return new Promise<State[]>((r,j)=>{
		bucket.listPrefix(scope, {prefix, limit}, function(e?: Error, respBody?: any, respInfo?: { statusCode: number }) {
			if (e || !respBody || !respInfo) {
				j(Error.new(e || 'read Qiniu file state '));
			} else if (respInfo.statusCode == 200) {
				r(respBody.items);
			} else {
				j(Error.new(errno.ERR_QINIU_RESULT_ERROR));
			}
		});
	});
}

export function state(key: string) {
	var {mac, scope} = uploadToken();
	var bucket = new qiniu.rs.BucketManager(mac, config());

	return new Promise<State>((r,j)=>{
		bucket.stat(scope, key, function(e?: Error, respBody?: State, respInfo?: { statusCode: number }) {
			if (e || !respBody || !respInfo) {
				j(Error.new(e || 'read Qiniu file state '));
			} else if (respInfo.statusCode == 200) {
				r(respBody);
			} else if (respInfo.statusCode == 612) {
				// status: 612,
				// statusCode: 612,
				// statusMessage: "status code 612",
				j(Error.new(errno.ERR_QINIU_STATE_FILE_404));
			} else {
				j(Error.new(errno.ERR_QINIU_RESULT_ERROR));
			}
		});
	});
}

export default function upload(src: string, dest?: string) {
	var resumeUploader = new qiniu.resume_up.ResumeUploader(config());

	// var formUploader = new qiniu.form_up.FormUploader(config);
	var putExtra = new qiniu.resume_up.PutExtra(); // new qiniu.form_up.PutExtra();
	var key = dest || path.basename(src);

	// putExtra.version = 'v2';
	// putExtra.partSize = 6 * 1024 * 1024;

	return new Promise<string>(function (resolve, reject) {
		resumeUploader.putFile(uploadToken().token, key, src, putExtra, function(respErr, respBody, respInfo) {
			if (respErr) {
				reject(Error.new(errno.ERR_QINIU_UPLOAD_ERR).ext(respErr));
			} else if (respInfo.statusCode == 200) {
				console.log('Qiniu', respBody/*, respInfo*/);
				resolve(key);
				// {"key":"qiniu.jpg","hash":"Ftgm-CkWePC9fzMBTRNmPMhGBcSV","bucket":"if-bc","fsize":39335,"name":"qiniu"}
			} else {
				reject(Error.new(errno.ERR_QINIU_UPLOAD_ERR).ext({ respInfo, respBody }));
			}
		});
	});
}
