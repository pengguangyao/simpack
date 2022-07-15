const path = require('path');
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse');
const generator = require('@babel/generator');
const ejs = require('ejs');
const { SyncHook } = require('tapable');

// console.log('root', process.cwd());

class Compiler {
    constructor(config) {
        this.config = config; // 配置项
        this.options = config; // 配置项
        this.root = process.cwd(); // Node.js 进程的当前工作目录
        this.modules = {}; // 所有的依赖模块集合
        this.rules = config?.module?.rules;
        // 声明钩子
        this.hooks = {
            compile: new SyncHook(['compilation']),
            afterCompile: new SyncHook(['compilation']),
            emit: new SyncHook(['compilation']),
            afterEmit: new SyncHook(['compilation']),
            done: new SyncHook(['compilation']),
        };

        // 注册所有插件的钩子
        if (Array.isArray(this.config.plugins)) {
            this.config.plugins.forEach(plugin => {
                plugin.apply(this);
            });
        }
    }

    // 解析文件
    depAnalyses(module) {
        let code = this.getSource(module);
        // 使用loader处理源代码
        code = this.useLoader(code, module);

        const ast = parser.parse(code, {
            sourceType: 'module',
        });

        const that = this;
        traverse.default(ast, {
            CallExpression(p) {
                // console.log('该类型语法节点的名称', p.node);
                if (p.node.callee.name === 'require') {
                    // 重命名require
                    p.node.callee.name = '__webpack_require__';
                    // 修改路径值
                    const oldVal = p.node.arguments[0].value;

                    // 将"./xxx" 路径 改为 "./src/xxx"
                    let newVal = './' + path.join('src', oldVal);
                    // 避免window的路径出现 "\"
                    newVal = newVal.replace(/\\/g, '/');
                    // console.log('newVal', newVal);
                    p.node.arguments[0].value = newVal;

                    that.depAnalyses(newVal);
                }
            },
            ExportDeclaration(p) {
                console.log('exprot', p.node.specifiers[0]);
            },
        });

        const sourceCode = generator.default(ast).code;

        // console.log('sourceCode', sourceCode);

        let modulePathRelative = './' + path.relative(this.root, module);
        modulePathRelative = modulePathRelative.replace(/\\/g, '/');

        // console.log('modulePathRelative', modulePathRelative);

        this.modules[modulePathRelative] = sourceCode;
    }

    useLoader(code, module) {
        // 未配置rules，不处理
        if (!this.rules) {
            return code;
        }

        for (let i = this.rules.length - 1; i >= 0; i--) {
            const { test, use } = this.rules[i];

            // 文件名称符合匹配规则
            if (test.test(module)) {
                // 如果单个匹配规则，多个loader，use字段为数组。单个loader，use字段为字符串或对象
                if (Array.isArray(use)) {
                    for (let j = use.length - 1; j >= 0; j--) {
                        const loader = use[j];
                        let loaderPath = typeof loader === 'string' ? loader : loader.loader;

                        // 获取loader的绝对路径
                        loaderPath = path.resolve(this.root, loaderPath);

                        // loader 上下文, 加入options配置参数
                        const options = loader.options;
                        const loaderContext = {
                            query: options,
                        };

                        // 导入loader
                        loader = require(loaderPath);
                        // 传入上下文 执行loader 处理源码
                        code = loader.call(loaderContext, code);
                    }
                } else {
                    let loaderPath = typeof use === 'string' ? use : use.loader;

                    // 获取loader的绝对路径
                    loaderPath = path.resolve(this.root, loaderPath);

                    // loader 上下文, 加入options配置参数
                    const options = use.options;
                    const loaderContext = {
                        query: options,
                    };

                    // 导入loader
                    const loader = require(loaderPath);
                    console.log('loader', loader);
                    // 传入上下文 执行loader 处理源码
                    code = loader.call(loaderContext, code);
                }
            }
        }

        return code;
    }

    // 读取文件内容
    getSource(path) {
        // 同步读取文件内容
        const content = fs.readFileSync(path, 'utf-8');
        return content;
    }

    // 启动
    start() {
        // 开始解析前的钩子
        this.hooks.compile.call(this);
        // 解析代码
        this.depAnalyses(path.resolve(this.root, this.config.entry));

        // 分析结束后，执行 afterCompile 钩子
        this.hooks.afterCompile.call();

        // 发射文件之前的钩子
        this.hooks.emit.call();

        // 输入打包结果
        this.emitFile();

        // 文件生成之后的钩子
        this.hooks.afterEmit.call();
    }

    // 生成文件
    emitFile() {
        // 读取代码渲染依据的模板
        const template = this.getSource(path.resolve(__dirname, '../template/output.ejs'));

        // console.log('modlues', this.modules);

        // 传入渲染模板、模板中用到的变量
        let result = ejs.render(template, {
            entry: this.config.entry,
            modules: this.modules,
        });

        // 获取输出路径
        let outputPath = path.join(this.config.output.path, this.config.output.filename);
        // console.log('outputPath', outputPath);

        fs.writeFileSync(outputPath, result);
    }
}

module.exports = Compiler;
