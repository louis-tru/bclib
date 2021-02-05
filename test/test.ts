
import { ViewController } from 'somes/ctr';

export default class extends ViewController {
	index({ test_name, ...args }: { test_name: string, args: any[] }) {
		var lib = require(`./test-${test_name}`);
		if (lib.default) {
			return lib.default(args);
		} else {
			return lib(args);
		}
	}
};
