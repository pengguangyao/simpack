const EntryOptionPlugin = require('./EntryOptionPlugin');

class WebpackOptionsApply {
    process(options, compiler) {
        new EntryOptionPlugin().apply(compiler);
        // 触发entryOption的钩子
        // console.log(options);
        // return;
        compiler.hooks.entryOption.call(options.context, options.entry);
    }
}

module.exports = WebpackOptionsApply;
