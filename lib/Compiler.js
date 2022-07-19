const { Tapable, SyncHook, AsyncSeriesHook, SyncBailHook } = require('tapable');
const Compilation = require('./Compilation');
const Stats = require('./Stats');
const mkdirp = require('mkdirp');
const path = require('path');

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
            afterCompile: new AsyncSeriesHook(['compilation']),
            make: new AsyncSeriesHook(['compilation']),
            emit: new AsyncSeriesHook(['compilation']),
            afterEmit: new AsyncSeriesHook(['comp']),
        };
    }

    emitAssets(compilation, callback) {
        // 文件生成操作的方法
        const emitFiles = err => {
            const assets = compilation.assets;
            let outputPath = this.options.output.path;

            for (let file in assets) {
                let source = assets[file];
                let targetPath = path.posix.join(outputPath, file);
                this.outputFileSystem.writeFileSync(targetPath, source);
            }
        };

        this.hooks.emit.callAsync(compilation, err => {
            // 创建文件夹
            mkdirp.sync(this.options.output.path);
            emitFiles();

            this.hooks.afterEmit.callAsync(compilation, err => {
                callback(err);
            });
        });
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
            // 输出文件到目录
            this.emitAssets(compilation, err => {
                const stats = new Stats(compilation);
                finalCallback(err, stats);
            });
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
