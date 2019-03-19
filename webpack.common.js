const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
//const DynamicImport = require('babel-plugin-syntax-dynamic-import');

module.exports = env => { // module.exports is function now to pass in env variable from cli defined in package.json
        return {
            entry: {
                'js/index': './src/index.js',
            },
            module: {
                rules: [{
                        test: /\.js$/,
                        exclude: [/node_modules/, /\.min\./, /vendor/, /autoComplete\.js/],
                        use: [{
                                loader: 'babel-loader',
                                /*options: {
                                    plugins: [DynamicImport]
                                }*/
                            },
                            {
                                loader: 'eslint-loader'
                            }
                        ]},
                        {
                            test: /\.csv$/,
                            loader: 'file-loader',
                            options: {
                                name: 'data/[name].[ext]?v=[hash:6]', 
                            }
                        },
                        {
                            test: /\.md$/,
                            use: [
                                {
                                    loader: 'html-loader'
                                },
                                {
                                    loader: 'markdown-loader',
                                    options: {
                                        smartypants: true
                                    }
                                }
                            ]
                        },
                        {
                            test: /\.svg$/,
                            use: [{
                                    loader: 'svg-url-loader',
                                }]
                        },
                        {
                            test: /partials\/.*\.html$/,
                            use: 'html-loader'
                        }

                    ]
                },
                plugins: [
                    new MiniCssExtractPlugin({
                        // Options similar to the same options in webpackOptions.output
                        // both options are optional
                        filename: "css/styles.css?v=[hash:6]",
                        chunkFilename: "[id].css",
                    })
                ],
                resolve: {
                    alias: {
                        "@App": path.join(__dirname, 'submodules/PCTApp-js/'),
                        "@Router": path.join(__dirname, 'submodules/ROUTR/'),
                        "@UI": path.join(__dirname, 'submodules/UI-js/'),
                        "@Project": path.join(__dirname, 'src'),
                        "@Utils": path.join(__dirname, 'submodules/UTILS/'),
                    }
                }
            }
        };