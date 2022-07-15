const { Tapable, SyncHook, AsyncSeriesHook, SyncBailHook } = require('tapable');
const Compilation = require('./Compilation');
const Stats = require('./Stats');

class Compiler extends Tapable {
    constructor(context) {
        super();
        this.context = context;
        this.hooks = {
            entryOption: new SyncBailHook(['context', 'entry']),
            compilation: new SyncHook(['compilation', 'normalModuleFactory']),
            beforeRun: new AsyncSeriesHook(['compiler']),
            run: new AsyncSeriesHook(['compiler']),
            failed: new SyncHook(),
            beforeCompiler: new AsyncSeriesHook(['compilationParams']),
            compile: new SyncHook(['compilationParams']),
            make: new AsyncSeriesHook(['compilation']),
        };
    }

    run(callback) {
        const finalCallback = (err, stats) => {
            if (err) {
                this.hooks.failed.call(err);
            }
            if (callback !== undefined) {
                callback(err, stats);
            }
        };

        const onCompiled = (err, compilation) => {
            if (err) return finalCallback(err);

            const stats = new Stats(compilation);
            callback(null, stats);
        };

        this.hooks.beforeRun.callAsync(this, err => {
            if (err) return finalCallback(err);

            this.hooks.run.callAsync(this, err => {
                if (err) return finalCallback(err);

                this.compile(onCompiled);
            });
        });
    }

    compile(callback) {
        const params = this.newCompilationParams();
        this.hooks.beforeCompiler.callAsync(params, err => {
            if (err) return callback(err);

            this.hooks.compile.call(params);

            const compilation = this.newCompilation(this);

            this.hooks.make.callAsync(compilation, err => {
                if (err) return callback(err);

                // callback(null, compilation);
                // 处理chunk
                compilation.seal(err => {
                    this.hooks.afterCompile.callAsync(compilation, err => {
                        callback(err, compilation);
                    });
                });
            });
        });
    }

    createNormalModuleFactory() {
        return {};
    }

    newCompilationParams() {
        const param = {
            normalModuleFactory: this.createNormalModuleFactory(),
        };
        return param;
    }

    newCompilation(params) {
        const compilation = new Compilation(params);
        return compilation;
    }
}

module.exports = Compiler;
