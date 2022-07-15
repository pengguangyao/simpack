const Compiler = require('./Compiler');
const NodeEnvironmentPlugin = require('./node/NodeEnvironmentPlugin');
const WebpackOptionsApply = require('./WebpackOptionsApply');
const webpack = options => {
    options.context = process.cwd();
    const compiler = new Compiler(options.context);

    new NodeEnvironmentPlugin().apply(compiler); // 注入文件操作系统
    // 执行配置插件
    if (options.plugins && Array.isArray(options.plugins)) {
        for (const plugin of options.plugins) {
            plugin.apply(compiler);
        }
    }
    new WebpackOptionsApply().process(options, compiler); // 执行内置插件
    return compiler;
};

module.exports = webpack;
