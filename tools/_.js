
var fs = require('fs');

try {
	require('somes');
} catch(e) {
	[`${__dirname}/../out/dphoto-magic/deps`, `${__dirname}/../deps`].some(e=>{
		if (fs.existsSync(e)) {
			// fs.symlinkSync(e, `${__dirname}/node_modules`);
			module.parent.paths.unshift(e);
			return true;
		}
	});
}