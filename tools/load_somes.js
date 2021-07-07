
var fs = require('fs');

function find_deps_lib(name, dir) {
	dir += '/deps';
	if (fs.existsSync(dir)) {
		for (var i of fs.readdirSync(dir)) {
			if (i == name) {
				if (fs.existsSync(`${dir}/${i}/package.json`)) {
					return `${dir}/${i}`;
				}
			} else {
				var lib = find_deps_lib(name, `${dir}/${i}`);
				if (lib) {
					return lib;
				}
			}
		}
	}
}

try {
	require('somes');
} catch(e) {
	[`${__dirname}/../../../out/dist`, `${__dirname}/..`].some(e=>{
		var lib = find_deps_lib('somes', e);
		if (lib) {
			// fs.symlinkSync(e, `${__dirname}/node_modules`);
			module.parent.paths.unshift(lib);
			return true;
		}
	});
}