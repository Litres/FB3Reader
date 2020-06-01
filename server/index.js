const express = require('express');
const webpack = require('webpack');
const middleware = require('webpack-dev-middleware');

const compiler = webpack(require('./webpack.config.js'));
const htmlTemplate = require('./template-html');

// Turns input into an array if not one already
function normalizeArray (arr) {
	return Array.isArray(arr) ? arr : [arr]
}

// Gets all the Javascript paths that Webpack has compiled, across chunks
function getAllJsPaths (webpackJson) {
	const { assetsByChunkName } = webpackJson
	return Object.values(assetsByChunkName).reduce((paths, assets) => {
		for (let asset of normalizeArray(assets)) {
			if (asset != null && asset.endsWith('.js')) {
				paths.push(asset)
			}
		}
		return paths
	}, [])
}

let port = 4444;
const index = Math.max(process.argv.indexOf('--port'), process.argv.indexOf('-p'));
if (index !== -1) {
	port = +process.argv[index + 1] || port
}
const app = express()
	.use(middleware(compiler, { serverSideRender: true }))
	.use('/static', express.static( __dirname + '/../__mocks__'))
	.use( (req, res) => {
		const webpackJson = res.locals.webpackStats.toJson();
		const paths = getAllJsPaths(webpackJson);
		res.send(htmlTemplate(paths));
	})
	.listen(port, () => {
		console.log(`Server started at http://localhost:${port}/`)
	});