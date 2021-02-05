/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import * as fs from 'somes/fs';
import * as path from 'path';
import * as cfg from '../config';

var variable = String(cfg.var) || path.resolve(__dirname, '../var');

fs.mkdir_p_sync(`${variable}/temp`);
fs.mkdir_p_sync(`${variable}/res`);
fs.chmodSync(`${variable}/temp`, 0o777);
// fs.writeFileSync(`${variable}/pid`, process.pid);

export default {
	var: variable,
	tmp: variable + '/temp',
	tmp_res_dir: variable + '/res',
	db_path: variable + '/db2.db',
};
