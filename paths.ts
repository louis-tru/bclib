/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import * as fs from 'somes/fs';
import * as path from 'path';
import cfg from './cfg';

var variable = String(cfg.var || path.resolve(__dirname, '../../var'));

fs.mkdirpSync(`${variable}/temp`);
fs.mkdirpSync(`${variable}/res`);
fs.mkdirpSync(`${variable}/temp/res`);
fs.mkdirpSync(`${variable}/temp/rm`);
// fs.chmodSync(`${variable}/temp`, 0o777);
fs.writeFileSync(`${variable}/pid`, String(process.pid));

export default {
	var: variable,
	res: variable + '/res',
	tmp: variable + '/temp',
	tmp_res: variable + '/temp/res',
	tmp_rm: variable + '/temp/rm',
};