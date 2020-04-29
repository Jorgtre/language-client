const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
    entry: './src/language-server-client.ts',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'language-server-client.js',
        libraryTarget: 'commonjs',
        path: path.resolve(__dirname, 'out')
    },
    plugins: [
        new CleanWebpackPlugin(),
    ],
};