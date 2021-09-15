/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-09-14
 */

import * as qiniu from 'qiniu';
import cfg from './cfg';
import * as path from 'path';
import errno from './errno';

export function uploadToken() {
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
	// config.zone = qiniu.zone.Zone_z0;
	// 是否使用https域名
	//config.useHttpsDomain = true;
	// 上传是否使用cdn加速
	config.useCdnDomain = true;

	var formUploader = new qiniu.form_up.FormUploader(config);
	var putExtra = new qiniu.form_up.PutExtra();
	var key = dest || path.basename(src);

	return new Promise<string>(function (resolve, reject) {
		formUploader.putFile(uploadToken(), key, src, putExtra, function(respErr, respBody, respInfo) {
			if (respErr) {
				reject(Error.new(errno.ERR_QINIU_UPLOAD_ERR).ext(respErr));
			} else if (respInfo.statusCode == 200) {
				console.log(respBody);
				resolve(key);
				// {"key":"qiniu.jpg","hash":"Ftgm-CkWePC9fzMBTRNmPMhGBcSV","bucket":"if-bc","fsize":39335,"name":"qiniu"}
			} else {
				reject(Error.new(errno.ERR_QINIU_UPLOAD_ERR).ext({ respInfo, respBody }));
			}
		});
	});
}
