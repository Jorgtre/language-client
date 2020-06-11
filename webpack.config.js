const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');

/**
 * @type import('webpack').Configuration
 */
module.exports = {
    entry: './src/language-client.ts',
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'language-client.js',
        libraryTarget: 'commonjs',
        path: path.resolve(__dirname, 'out'),
    },
    plugins: [
        new CleanWebpackPlugin()
    ],
};