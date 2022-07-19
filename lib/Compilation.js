const path = require('path');
const { Tapable } = require('tapable');
const async = require('neo-async');
const Parser = require('./Parser');
const NormalModuleFactory = require('./NormalModuleFactory');
const { SyncHook } = require('tapable');
const Chunk = require('./Chunk');
const ejs = require('ejs');

const normalModuleFactory = new NormalModuleFactory();
const parser = new Parser();

class Compilation extends Tapable {
    constructor(compiler) {
        super();
        this.compiler = compiler;
        this.context = compiler.context;
        this.options = compiler.options;
        this.inputFileSystem = compiler.inputFileSystem;

        this.entries = []; // 存放所有入口的文件
        this.modules = []; // 存放所有的模块

        this.chunks = []; // 存放当前打包过程中长生的chunk
        this.assets = [];
        this.files = [];

        this.hooks = {
            successModule: new SyncHook(['moudle']),
            seal: new SyncHook(),
            beforeChunks: new SyncHook(),
            afterChunks: new SyncHook(),
        };
    }

    addEntry(context, entry, name, callback) {
        this._addModuleChain(context, entry, name, (err, module) => {
            callback(err, module);
        });
    }

    _addModuleChain(context, entry, name, callback) {
        this.createModule(
            {
                name,
                context,
                rawRequest: entry,
                resource: path.posix.join(context, entry),
                moduleId: './' + path.posix.relative(context, path.posix.join(context, entry)),
                parser,
            },
            entryModule => {
                this.entries.push(entryModule);
            },
            callback,
        );
    }

    createModule(data, doAddEntry, callback) {
        let module = normalModuleFactory.create(data);

        const afterBuild = (err, module) => {
            if (module.dependencies.length > 0) {
                this.processDependencies(module, err => {
                    callback(err, module);
                });
            } else {
                callback(err, module);
            }
        };

        this.buildModule(module, afterBuild);

        doAddEntry && doAddEntry(module);
        this.modules.push(module);
    }

    buildModule(module, callback) {
        module.build(this, err => {
            // 如果代码走到这里module模块编译结束
            this.hooks.successModule.call(module);
            callback(err, module);
        });
    }

    processDependencies(module, callback) {
        const dependencies = module.dependencies;
        async.forEach(
            dependencies,
            (dependency, done) => {
                this.createModule(
                    {
                        name: dependency.name,
                        context: dependency.context,
                        rawRequest: dependency.rawRequest,
                        moduleId: dependency.moduleId,
                        resource: dependency.resource,
                        parser,
                    },
                    null,
                    done,
                );
            },
            err => {
                callback(err);
            },
        );
    }

    seal(callback) {
        this.hooks.seal.call();
        this.hooks.beforeChunks.call();

        // chunk,依据入口，然后找到他所依赖的所有模块，然后组装在一起
        for (const entryModule of this.entries) {
            const chunk = new Chunk(entryModule);

            this.chunks.push(chunk);

            // 给chunk属性赋值
            chunk.modules = this.modules.filter(module => module.name === chunk.name);
        }

        this.hooks.afterChunks.call(this.chunks);

        // 生成代码内容
        this.createChunkAssets();

        callback();
    }

    createChunkAssets() {
        for (let i = 0; i < this.chunks.length; i++) {
            const chunk = this.chunks[i];
            const fileName = chunk.name + '.js';
            chunk.files.push(fileName);

            // const tem
            let tempCode = this.inputFileSystem.readFileSync(
                path.posix.join(__dirname, 'template/output.ejs'),
                'utf8',
            );
            // console.log('chunk.modules', chunk.modules);
            const source = ejs.render(tempCode, {
                entry: chunk.entryModule.moduleId,
                modules: chunk.modules,
            });

            // 输出文件
            this.emitAssets(fileName, source);
        }
    }

    emitAssets(fileName, source) {
        this.assets[fileName] = source;
        this.files.push(fileName);
    }
}

module.exports = Compilation;
