#!/usr/bin/env node
// 上面代码用来声明 执行环境

const path = require('path');
// const config = require(path.resolve('webpack.config.js'));
// const Compiler = require('../lib/compiler');

// const compiler = new Compiler(config);
// compiler.start();

const config = require(path.resolve('webpack.config.js'));
const webpack = require('../lib/webpack.js');

const compiler = webpack(config);

compiler.run((err, stats) => {
    // console.log(stats.toJson());
});
