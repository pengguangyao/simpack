const path = require('path');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const types = require('@babel/types');
class NormalModule {
    constructor(data) {
        this.context = data.context;
        this.name = data.name;
        this.rawRequest = data.rawRequest;
        this.moduleId = data.moduleId;
        this.parser = data.parser;
        this.resource = data.resource;

        this.dependencies = []; // 收集依赖
    }

    build(compilation, callback) {
        /**
         * 1, 从文件读取内容
         * 2, 如果不是js模块，利用loader进行处理
         * 3, 将js代码转为ast
         * 4, 当前js内部有可能引用其他模块，需要递归处理
         */
        this.doBuild(compilation, err => {
            this._ast = this.parser.parse(this._source);

            // 代码修改
            traverse(this._ast, {
                CallExpression: nodePath => {
                    const node = nodePath.node;
                    if (node.callee.name === 'require') {
                        let moudlePath = node.arguments[0].value;
                        // 默认文件都为js文件
                        let moduleName = moudlePath.split(path.posix.sep).pop();
                        // console.log('path-------->', path.posix.sep, moduleName);
                        const extName = moduleName.includes('.') ? '' : '.js';
                        moduleName += extName;

                        // 绝对路径
                        const depResource = path.posix.join(
                            path.posix.dirname(this.resource),
                            moduleName,
                        );

                        // 定义当前模块的id
                        let depModuleId = './' + path.posix.relative(this.context, depResource);

                        // 记录当前被依赖模块的信息
                        this.dependencies.push({
                            name: this.name,
                            context: this.context,
                            rawRequest: this.rawRequest,
                            moduleId: depModuleId,
                            resource: depResource,
                        });

                        node.callee.name = '__webpack_require__';
                        node.arguments = [types.stringLiteral(depModuleId)];
                    }
                },
            });

            // 将修改后的ast转为代码
            const { code } = generator(this._ast);
            this._source = code;
            callback(err);
        });
    }

    doBuild(compilation, callback) {
        this.getSource(compilation, (err, source) => {
            if (err) {
                callback(err);
                return;
            }
            this._source = source;
            callback();
        });
    }

    // 读取资源
    getSource(compilation, callback) {
        compilation.inputFileSystem.readFile(this.moduleId, 'utf8', callback);
    }
}

module.exports = NormalModule;
