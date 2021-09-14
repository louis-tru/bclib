/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-09-14
 */

import * as qiniu from 'qiniu';

var accessKey = 'your access key';
var secretKey = 'your secret key';
var mac = new qiniu.auth.digest.Mac(accessKey, secretKey);

var options = {
  scope: bucket,
};
var putPolicy = new qiniu.rs.PutPolicy(options);
var uploadToken=putPolicy.uploadToken(mac);

export default async function upload(src: string, dest?: string) {
	// TODO ...
	return '';
}
