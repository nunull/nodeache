#!/usr/bin/env node

var fs = require('fs');
var http = require('http');
var util = require('util');
var handlebars = require('handlebars');
var markdown = require('markdown').markdown;
var sass = require('node-sass');
var CleanCSS = require('clean-css');
var UglifyJS = require("uglify-js");
var fsmonitor = require('fsmonitor');
var JSFtp = require('jsftp');
var pkg = require('./package.json');

var parsableExt = ['json', 'md', 'markdown', 'html', 'css', 'scss', 'js'];
var msgs = {
	welcome: function() {return pkg.name + '   v' + pkg.version + '\n';},
	info: function() {return 'Copyright: (' + pkg.licenses + ') 2014 ' + pkg.author.name + '\n'},
	usage: function() {return 'Usage: nodeache folder\n       nodeache dev folder\n       nodeache publish folder\n       nodeache info\n'},
	parsing: function() {return getTimeFormatted() + ' Parsing \'' + pageFolder + '\'... '},
	serverRunning: function() {return getTimeFormatted() + ' Server running at \'http://localhost:8008\'.\n'},
	done: function() {return 'done.\n'},
	ftp: {
		connecting: function() {return getTimeFormatted() + ' Connecting to \'' + config.ftp.host + '\'... '},
		disconnecting: function() {return getTimeFormatted() + ' Disconnecting from \'' + config.ftp.host + '\'... '},
		uploading: function() {return getTimeFormatted() + ' Uploading to \'' + config.ftp.host + '\'... '}
	},
	err: {
		pageDir: function() {return getTimeFormatted() + ' Error: ' + pageFolder + ' does not exist.\n'},
		templateDir: function() {return getTimeFormatted() + ' Error: ' + pageFolder + '/templates does not exist.\n'},
		contentDir: function() {return getTimeFormatted() + ' Error: ' + pageFolder + '/content does not exist.\n'},
		ftp: {
			authData: function() {return 'Error: authentification-data for FTP is not specfied.\n'}
		}
	}
};

var command = null;
var pageFolder = null;

if(process.argv.length === 3) {
	pageFolder = process.argv[2];
} else if(process.argv.length === 4) {
	command = process.argv[2];
	pageFolder = process.argv[3];
}
if(pageFolder === 'info') {
	command = pageFolder;
	pageFolder = null;
}

function getTimeFormatted() {
	var d = new Date();
	var time = (d.getHours() < 10 ? '0' + d.getHours() : d.getHours());
	time += ':' + (d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes());
	time += ':' + (d.getSeconds() < 10 ? '0' + d.getSeconds() : d.getSeconds());

	return '[' + time + ']';
}

var readDirectory = function(directory, subDirectory, exclude, readData) {
	if(subDirectory === undefined) subDirectory = '';
	if(exclude === undefined) exclude = [];
	var files = [];

	var internPath = (directory + subDirectory).replace(pageFolder + '/', '');
	internPath = internPath.split('/');
	internPath.pop();
	internPath = internPath.join('/');

	fs.readdirSync(directory + subDirectory).forEach(function(file) {
		if(fs.statSync(directory + subDirectory + file).isFile() && file !== '.DS_Store') {
			var ext = file.split('.').reverse()[0];

			var parsable = false;
			for(var i = 0, j = parsableExt.length; i < j; i++) {
				if(parsableExt[i] === ext) {
					parsable = true;
				}
			}

			for(var i = 0, j = exclude.length; i < j; i++) {
				if(exclude[i] === internPath + '/' + file || internPath.indexOf(exclude[i]) === 0) {
					parsable = false;
				}
			}

			var data = '';

			if(readData) {
				if(parsable) {
					data = fs.readFileSync(directory + subDirectory + file, {
						encoding: 'utf8'
					});
				} else {
					data = fs.readFileSync(directory + subDirectory + file);
				}
			} else {
				data = undefined;
			}

			files.push({
				file: subDirectory + file,
				ext: ext,
				parsable: parsable,
				data: data
			});
		} else if(fs.statSync(directory + subDirectory + file).isDirectory()) {
			var tmp = readDirectory(directory, subDirectory + file + '/', exclude, readData);

			for(var i = 0, j = tmp.length; i < j; i++) {
				files.push(tmp[i]);
			}
		}
	});

	return files;
}

var deleteFolderRecursive = function(path) {
	var files = [];
	if(fs.existsSync(path)) {
		files = fs.readdirSync(path);
		files.forEach(function(file, index){
			var curPath = path + '/' + file;

			if(fs.statSync(curPath).isDirectory()) {
				deleteFolderRecursive(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

var mkdirRecursive = function(directory) {
	var items = directory.split('/');

	var curItems = [];
	for(var i = 0, j = items.length; i < j; i++) {
		curItems.push(items[i]);
		var curPath = curItems.join('/');
		if(!fs.existsSync(curPath) || !fs.statSync(curPath).isDirectory()) {
			fs.mkdirSync(curPath);
		}
	}
}

var Content = (function() {
	var objectify = function(name, content) {
		var items = name.split('/');
		var tmp = {};
		tmp[name] = content;

		if(items.length >= 2) {
			var name = items[items.length-1];

			// Replace 'XX-' at the beginning of the name (it is only for sorting files on the filesystem)
			if(name.search(/\d\d-/) == 0) {
				name = name.replace(/\d\d-/, '');
			}

			tmp = {
				name: name,
				data: content
			};

			for(var i = items.length-2; i >= 0; i--) {
				var tmp2 = tmp;
				tmp = {};
				tmp[items[i]] = tmp2;
			}
		}

		return tmp;
	};

	return {
		parse: function(content) {
			var ext = content.file.split('.');
			ext = ext[ext.length-1];

			var name = content.file.split('.').reverse().join('.').replace(ext + '.', '').split(' ').reverse().join('.');
			
			var ret = {};
			if(ext === 'md') {
				ret[name] = markdown.toHTML(content.data);
				ret[name] = ret[name]
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&quot;/g, '"');
				
				return ret;
			} else if(ext === 'json') {
				ret = JSON.parse(content.data);

				return ret;
			}

			return null;
		},

		join: function(content) {
			// Objectify
			var tmp = [];
			for(var i = 0, j = content.length; i < j; i++) {
				var c = content[i];
				if(c !== null) {
					for(var key in c) {
						tmp.push(objectify(key, c[key]));
					}
				}
			}

			// Join
			var ret = {};
			for(var i = 0, j = tmp.length; i < j; i++) {
				// var arr = [];
				for(var key in tmp[i]) {
					for(var key2 in tmp[i]) {
						if(key === key2) {
							if(ret[key] === undefined) ret[key] = [];
							ret[key].push(tmp[i][key]);
						}
					}
				}
			}

			// Convert arrays containing only one element to string
			for(var key in ret) {
				if(ret[key].length === 1) {
					ret[key] = ret[key][0];
				}
			}

			return ret;
		}
	};
})();

// The main-functionality
function main() {
	var error = false;

	if(fs.existsSync(pageFolder + '/templates/')) {
		var templates = readDirectory(pageFolder + '/templates/', '', config.ignore, true);
	} else {
		util.print(msgs.err.templateDir());
		error = true;
	}
	if(fs.existsSync(pageFolder + '/content/')) {
		var content = readDirectory(pageFolder + '/content/', '', config.ignore, true);
	} else {
		util.print(msgs.err.contentDir());
		error = true;
	}

	var output = [];

	if(error) {
		return false;
	}

	util.print(msgs.parsing());

	// Parse content
	var tmp = [];
	for(var i = 0, j = content.length; i < j; i++) {
		tmp.push(Content.parse(content[i]));
	}
	content = Content.join(tmp);

	// Parse content TODO
	for(var i = 0, j = templates.length; i < j; i++) {
		if(templates[i].ext === 'scss' && config.parse.sass) {
			templates[i].data = sass.renderSync({
				data: templates[i].data
			});

			// console.log(templates[i].file);
			var file = templates[i].file;
			file = file.split('.');
			file.pop();
			file.push('css');
			file = file.join('.');
			templates[i].file = file;
		}
		if((templates[i].ext === 'css' && config.parse.css === 'compressed') || 
					(templates[i].ext === 'scss' && config.parse.sass === 'compressed') && config.debug !== true) {
			templates[i].data = new CleanCSS().minify(templates[i].data);

			var file = templates[i].file;
			file = file.split('.');
			file.pop();
			file.push('min');
			file.push('css');
			file = file.join('.');
			templates[i].file = file;
		} else if(templates[i].ext === 'js' && config.parse.js === 'compressed' && config.debug !== true) {
			if(templates[i].file.indexOf('.min.js') < 0) {
				templates[i].data = UglifyJS.minify(templates[i].data+'', {
					fromString: true
				}).code;

				var file = templates[i].file;
				file = file.split('.');
				file.pop();
				file.push('min');
				file.push(templates[i].ext);
				file = file.join('.');
				templates[i].file = file;
			}
		}

		if(templates[i].parsable) {
			var data = templates[i].data;

			try {
				data = handlebars.compile(data)(content);
			} catch(e) {
				// TODO
			}

			templates[i].data = data;
		}
	}

	// Parse output
	for(var i = 0, j = templates.length; i < j; i++) {
		var data = templates[i].data;

		if(templates[i].parsable) {
			try {
				data = handlebars.compile(data)(content);
				data = data.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/').replace(/&quot;/g, '"');
			} catch(e) {
				// TODO
			}
		}

		output.push({
			file: templates[i].file,
			parsable: templates[i].parsable,
			data: data
		});
	}

	// Clear output directoy
	deleteFolderRecursive(pageFolder + '/output/');

	// Write output
	for(var i = 0, j = output.length; i < j; i++) {
		var path = pageFolder + '/output/' + output[i].file;
		var directory = path.split('/');
		directory.pop();
		directory = directory.join('/');

		mkdirRecursive(directory);
		
		fs.writeFileSync(path, output[i].data);
	}

	util.print(msgs.done());
}

var config = [];
if(fs.existsSync(pageFolder + '/config.json') && fs.statSync(pageFolder + '/config.json').isFile()) {
	config = JSON.parse(fs.readFileSync(pageFolder + '/config.json', {
		encoding: 'utf8'
	}));
}

/*
 * Provides helping functions for FTP.
 */
var ftpHelper = (function() {
	return {
		upload: function (file, ftp, callback) {
			ftpHelper.mkd(file, ftp, function() {
				ftp.raw.cwd('/', function(err, data) {
					ftp.put(pageFolder + '/output/' + file, file, function(hadError) {
						if(hadError) {
							// TODO
						}

						if(callback) callback();
					});
				});
				
			});
		},

		mkd: function(file, ftp, callback, index_) {
			var dirs = file.split('/');
			dirs.pop();

			var index = 0;
			if(index_) index = index_;
			
			var wd = '/';
			for(var i = 0; i < index; i++) {
				wd += dirs[i] + '/';
			}

			ftp.raw.cwd(wd, function(err, data) {
				ftp.raw.mkd(dirs[index], function(err, data) {
					// if (err) console.error(err);

					ftp.raw.cwd(wd, function(err, data) {
						// if (err) console.error(err);

						if(index < dirs.length) {
							ftpHelper.mkd(file, ftp, callback, index+1);
						} else {
							if(callback) callback();
						}
					});
				});
			});
		}
	}
})();

var localhost = (function() {
	return {
		boot: function() {
			http.createServer(function (req, res) {
				var url = req.url;
				if(url === '/') url = '/index.html';
				url = pageFolder + '/output' + url;

				var code = 200;
				var data = '';
				try {
					data = fs.readFileSync(url);
				} catch(e) {
					code = 404;
				}

				res.writeHead(code);
				res.end(data);

				console.log(getTimeFormatted() + ' Client request: \'' + url + '\' (' + code + ').');
			}).listen(8008, '127.0.0.1');
			util.print(msgs.serverRunning());
		}
	};
})();

util.print(msgs.welcome());

if(!pageFolder && command !== 'info') {
	util.print(msgs.usage());
} else if(!fs.existsSync(pageFolder) && command !== 'info') {
	util.print(msgs.err.pageDir());
} else if(command) {
	if(command === 'dev') {
		localhost.boot();
		main();

		fsmonitor.watch(pageFolder + '/templates/', null, main);
		fsmonitor.watch(pageFolder + '/content/', null, main);
	} else if(command === 'publish') {
		main();

		if(config.ftp.host && config.ftp.user && config.ftp.password) {
			util.print(msgs.ftp.connecting());

			var ftp = new JSFtp({
				host: config.ftp.host,
				port: 21
			});

			ftp.auth(config.ftp.user, config.ftp.password, function(err) {
				util.print(msgs.done());

				var callback = function() {
					i++;

					if(i < files.length) {
						ftpHelper.upload(files[i].file, ftp, callback);
					} else {
						util.print(msgs.done());
						util.print(msgs.ftp.disconnecting());
						ftp.raw.quit(function(err, data) {
							util.print(msgs.done());
						});
					}
				};

				util.print(msgs.ftp.uploading());
				var files = readDirectory(pageFolder + '/output/', '', config.ignore, false);
				var i = 0;
				ftpHelper.upload(files[i].file, ftp, callback);
			});
		} else {
			util.print(msgs.err.ftp.authData());
		}
	} else if(command === 'info') {
		util.print(msgs.info());
	}
} else {
	main();
}