
import {KeysManager} from './keys';

var _keys: KeysManager | undefined;

export default {

	get impl() {
		if (!_keys) {
			_keys = new KeysManager();
		}
		return _keys;
	},

	set_impl(impl: KeysManager) {
		_keys = impl;
	},

};