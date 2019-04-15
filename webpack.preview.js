const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.nondev.js');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const PrerenderSPAPlugin = require('prerender-spa-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const pretty = require('pretty');
const HtmlReplaceWebpackPlugin = require('html-replace-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

const repoName = 'abx';

module.exports = env => {
    return merge(common(), {
        devtool: 'inline-source-map', // may be too slow an option; set to another if so
        plugins: [
            new CleanWebpackPlugin(['docs']),
            new HtmlWebpackPlugin({
                title: 'Analysis Shows Continued Deficiencies in Antiobiotic Development',
                template: './src/index-dev.html',
            }),
            new HtmlReplaceWebpackPlugin([
                {
                    pattern: /\/?-\//,
                    replacement: ''
                }
            ]),
            new CopyWebpackPlugin([{ // this rewrites the /-/ paths to ./ so that the preview can be hosted
                                     // on github pages, which trips up on subdirectories that start with hyphen or other specials
                from: './**/*.*',
                to: './',
                context: 'src/-/'
            }, {
                from: 'assets/**/*.*',
                exclude: 'assets/Pew/css/',
                context: 'src',
            }, {
                from: 'assets/Pew/css/*.*',
                context: 'src',
                transform(content, path) {
                    return content.toString().replace(/url\("\/([^/])/g, 'url("/' + repoName + '/$1').replace(/\/pew\//g,'/Pew/'); // this modifies the content of the files being copied; here making sure url('/...') is changed
                }
            }]),
            new PrerenderSPAPlugin({
                // Required - The path to the webpack-outputted app to prerender.
                staticDir: path.join(__dirname, '/docs/'),
                // Required - Routes to render.
                routes: ['/'],
                renderer: new PrerenderSPAPlugin.PuppeteerRenderer({
                    injectProperty: 'IS_PRERENDERING',
                    inject: true,
                    renderAfterTime: 1000
                }),
                postProcess: function(renderedRoute){
                    renderedRoute.html = pretty(renderedRoute.html);
                    return renderedRoute;
                }
            }),
            new webpack.EnvironmentPlugin({
                'NODE_ENV': env
            })
        ],
        output: {
            filename: '[name].js',
            path: path.join(__dirname, '/docs/'),
        }
      });
  };
   