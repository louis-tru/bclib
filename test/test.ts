
import { ViewController } from 'somes/ctr';

export default function(name: string, dir: string) {
	return class extends ViewController {
		index({ test_name, ...args }: { test_name: string, args: any[] }) {
			var lib = require(`${dir}/${name}-${test_name}`);
			if (lib.default) {
				return lib.default(args, this);
			} else {
				return lib(args);
			}
		}
	};
}