const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

module.exports = env => { // module.exports is function now to pass in env variable from cli defined in package.json
    return merge(common(), {
        devtool: 'source-map',
        devServer: {
            contentBase: './dist',
            hot: true
        },
        mode: 'development',
        module: {
            rules: [{
                test: /\.scss$/,
                use: [{
                        loader: 'style-loader'
                    }, {
                        loader: 'css-loader',
                        options: {
                            modules: true,
                            localIdentName: '[path]-[local]', // in dev mode hash not necessary to brak caches but incuding path
                            // should avoid collisions of classes with same names
                            sourceMap: true,
                            importLoaders: 1
                        }
                    },
                    {
                           loader: 'postcss-loader',
                           options: {
                               sourceMap: true,
                               ident: 'postcss',
                               plugins: (loader) => [
                                   require('postcss-assets')()
                               ]
                           }
                       }, {
                        loader: 'sass-loader',
                        options: {
                            sourceMap: true
                        }
                    }, // any scss files to be excluded from renaming the classes
                ]
            },
            {
                test: /\.css$/,
                use: [{
                        loader: 'style-loader'
                    }, {
                        loader: 'css-loader',
                        options: {
                            modules: true,
                            localIdentName: '[local]', // in dev mode hash not necessary to brak caches but incuding path
                        }
                    }
                ]
            }]
        },
        plugins: [
            
            new HtmlWebpackPlugin({
                title: 'title title title',
                template: './src/index-dev.html',
            }),
            new CopyWebpackPlugin([{
                from: '-/**/*.*',
                context: 'src'
            }, {
                from: 'assets/**/*.*',
                context: 'src',
            }
            ]),
            new webpack.HotModuleReplacementPlugin(),
            new webpack.EnvironmentPlugin({
                'NODE_ENV': env
            })
        ],
        output: {
            filename: '[name].js?v=[hash:6]',
            path: path.resolve(__dirname, 'dist')
        },
    });
};