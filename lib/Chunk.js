class Chunk {
    constructor(entryModule) {
        this.entryModule = entryModule;
        this.name = entryModule.name;
        this.files = []; // 记录每个chunk的文件信息
        this.modules = []; // 记录每个chunk所包含的模块信息
    }
}

module.exports = Chunk;
