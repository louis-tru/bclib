/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-12-08
 */

import web3 from '../web3+';
import Happy from 'web3-tx/happy';

import * as LicenseTypes from './artifacts/LicenseTypes';
import * as Users from './artifacts/Users';
import * as Logs from './artifacts/Logs';
import * as Organizations from './artifacts/Organizations';

export default {
	get license_types() { return Happy.instance<LicenseTypes.default>(LicenseTypes, web3.impl) },
	get users() { return Happy.instance<Users.default>(Users, web3.impl) },
	get logs() { return Happy.instance<Logs.default>(Logs, web3.impl) },
	get organizations() { return Happy.instance<Organizations.default>(Organizations, web3.impl) },
}