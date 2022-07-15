const babylon = require('babylon');
class Parser {
    parse(source) {
        return babylon.parse(source, {
            sourceType: 'module',
            plugins: ['dynamicImport'], // 当前插件可以支持import动态导入
        });
    }
}

module.exports = Parser;
