import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    mode: 'production',
    entry: {
        chat: './app/js/chat.js',
        index: './app/js/index.js'
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
                        presets: ['@babel/preset-env'],
                        plugins: ['@babel/plugin-syntax-dynamic-import']
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
            filename: 'css/[name].[contenthash].css'
        }),
        new HtmlWebpackPlugin({
            template: 'app/chat.html',
            filename: 'chat.html',
            chunks: ['chat'],
            scriptLoading: 'module', // This ensures the script tag uses type="module"
            minify: {
                removeComments: true,
                collapseWhitespace: true
            }
        }),
        new HtmlWebpackPlugin({
            template: 'app/index.html',
            filename: 'index.html',
            chunks: ['index'],
            scriptLoading: 'module', // This ensures the script tag uses type="module"
            minify: {
                removeComments: true,
                collapseWhitespace: true
            }
        })
    ],
    optimization: {
        minimize: true,
        moduleIds: 'deterministic',
        minimizer: [
            '...', // Keeps the default minimizers (like Terser for JS)
            new CssMinimizerPlugin()
        ]
    },
    experiments: {
        topLevelAwait: true,
        outputModule: true
    },
    externalsType: 'module',
    externals: {
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/highlight.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/highlight.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/python.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/python.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/javascript.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/javascript.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/typescript.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/typescript.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/bash.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/bash.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/sql.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/sql.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/json.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/json.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/xml.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/xml.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/yaml.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/yaml.min.js',
        'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/css.min.js': 'module https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/css.min.js',
        'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js': 'module https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js'
    }
};
