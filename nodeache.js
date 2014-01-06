#!/usr/bin/env node

var fs = require('fs');
var util = require('util');
var mustache = require('mustache');
var markdown = require('markdown').markdown;
var fsmonitor = require('fsmonitor');

var command = null;
var pageFolder = null;

if(process.argv.length === 3) {
	pageFolder = process.argv[2];
} else if(process.argv.length === 4) {
	command = process.argv[2];
	pageFolder = process.argv[3];
}

var readDirectory = function(directory, subDirectory) {
	if(subDirectory === undefined) subDirectory = '';
	var files = [];

	fs.readdirSync(directory + subDirectory).forEach(function(file) {
		if(fs.statSync(directory + subDirectory + file).isFile() && file !== '.DS_Store') {
			var data = fs.readFileSync(directory + subDirectory + file, {
				encoding: 'utf8'
			});
			files.push({
				file: subDirectory + file,
				data: data
			});
		} else if(fs.statSync(directory + subDirectory + file).isDirectory()) {
			var tmp = readDirectory(directory, subDirectory + file + '/');

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
	var start = new Date();
	var time = (start.getHours() < 10 ? '0' + start.getHours() : start.getHours());
	time += ':' + (start.getMinutes() < 10 ? '0' + start.getMinutes() : start.getMinutes());
	time += ':' + (start.getSeconds() < 10 ? '0' + start.getSeconds() : start.getSeconds());

	var error = false;

	if(fs.existsSync(pageFolder + '/templates/')) {
		var templates = readDirectory(pageFolder + '/templates/');
	} else {
		console.log('[' + time + '] Error: ' + pageFolder + '/templates does not exist.');
		error = true;
	}
	if(fs.existsSync(pageFolder + '/content/')) {
		var content = readDirectory(pageFolder + '/content/');
	} else {
		console.log('[' + time + '] Error: ' + pageFolder + '/content does not exist.');
		error = true;
	}
	var output = [];

	if(error) {
		return false;
	}

	util.print('[' + time + '] Parsing "' + pageFolder + '"... ');

	// Parse content
	var tmp = [];
	for(var i = 0, j = content.length; i < j; i++) {
		tmp.push(Content.parse(content[i]));
	}
	content = Content.join(tmp);

	// Parse output
	for(var i = 0, j = templates.length; i < j; i++) {
		var data = mustache.to_html(templates[i].data, content);

		output.push({
			file: templates[i].file,
			data: data.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/').replace(/&quot;/g, '"')
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

	console.log('done.');
}

if(!pageFolder) {
	console.log('Usage: nodeache folder');
	console.log('       nodeache dev folder');
} else if(!fs.existsSync(pageFolder)) {
	var start = new Date();
	var time = (start.getHours() < 10 ? '0' + start.getHours() : start.getHours());
	time += ':' + (start.getMinutes() < 10 ? '0' + start.getMinutes() : start.getMinutes());
	time += ':' + (start.getSeconds() < 10 ? '0' + start.getSeconds() : start.getSeconds());
	console.log('[' + time + '] Error: ' + pageFolder + ' does not exist.');
} else if(command) {
	if(command === 'dev') {
		main();
		
		var onFileChange = function(change) {
			if(change.modifiedFiles.length > 0) {
				main();
			}
		};

		fsmonitor.watch(pageFolder + '/templates/', null, onFileChange);
		fsmonitor.watch(pageFolder + '/content/', null, onFileChange);
	}
} else {
	main();
}