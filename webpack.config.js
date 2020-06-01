const path = require('path');
const {CleanWebpackPlugin} = require("clean-webpack-plugin");

module.exports = {
    entry: './src/index.ts',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'FB3Reader',
        libraryTarget: 'umd',
        publicPath: '/dist/index.js',
        umdNamedDefine: true
    },
    plugins: [
        new CleanWebpackPlugin()
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: "babel-loader?presets[]=@babel/env!ts-loader"
            }
        ]
    },
    resolve: {
        extensions: [".js", ".ts"]
    },

	// these shouldn't be packed
	externals: {
    	"sha256": "sha256",
		"lz-string": "lz-string",
		"date-fns": "date-fns"
	},
    mode: "production"
};