const path = require('path');

/**
 * Webpack config to create build for future E2E tests using Puppeteer
 */

module.exports = {
	entry: {
		'main': path.resolve(__dirname, 'src', 'index.ts')
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: "ts-loader"
			},
			{
				test: /\.css$/,
				use: [
					{
						loader: 'style-loader'
					},
					{
						loader: 'css-loader'
					}
				]
			}
		]
	},
	resolve: {
		extensions: [".js", ".ts", ".css"]
	},
	mode: "production"
};