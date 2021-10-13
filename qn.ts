/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-09-14
 */

import * as qiniu from 'qiniu';
import cfg from './cfg';
import * as path from 'path';
import errno from './errno';
import somes from 'somes';

export function uploadToken() {
	somes.assert(cfg.qiniu, errno.ERR_NO_QINIU_CONFIG);
	if (cfg.qiniu) {
		var mac = new qiniu.auth.digest.Mac(cfg.qiniu.accessKey, cfg.qiniu.secretKey);
		var putPolicy = new qiniu.rs.PutPolicy({ scope: cfg.qiniu.scope });
		var uploadToken = putPolicy.uploadToken(mac);
		return uploadToken;
	}
	return '';
}

export default function upload(src: string, dest?: string) {

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

	var resumeUploader = new qiniu.resume_up.ResumeUploader(config);

	// var formUploader = new qiniu.form_up.FormUploader(config);
	var putExtra = new qiniu.resume_up.PutExtra(); // new qiniu.form_up.PutExtra();
	var key = dest || path.basename(src);

	// putExtra.version = 'v2';
	// putExtra.partSize = 6 * 1024 * 1024;

	return new Promise<string>(function (resolve, reject) {
		resumeUploader.putFile(uploadToken(), key, src, putExtra, function(respErr, respBody, respInfo) {
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
