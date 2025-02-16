import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    mode: 'production',
    entry: {
        chat: './app/js/chat.js',
        welcome: './app/js/welcome.js'
    },
    output: {
        path: resolve(__dirname, 'dist'),
        filename: 'js/[name].[contenthash].js',
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader'
                ]
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin(),
        new MiniCssExtractPlugin({
            filename: 'app/css/[name].[contenthash].css'
        }),
        new HtmlWebpackPlugin({
            template: 'app/chat.html',
            filename: 'chat.html',
            chunks: ['chat'],
            minify: {
                removeComments: true,
                collapseWhitespace: true
            }
        }),
        new HtmlWebpackPlugin({
            template: 'app/index.html',
            filename: 'index.html',
            chunks: ['index'],
            minify: {
                removeComments: true,
                collapseWhitespace: true
            }
        })
    ],
    optimization: {
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all'
                }
            }
        }
    }
};