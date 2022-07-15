class SingleEntryPlugin {
    constructor(context, entry, name) {
        this.context = context;
        this.entry = entry;
        this.name = name;
    }

    apply(compiler) {
        compiler.hooks.compilation.tap(
            'SingleEntryPlugin',
            (compilation, { normalModuleFactory }) => {
                // compilation.dependencyFactories.set(SingleEntryDependency, normalModuleFactory);
            },
        );

        compiler.hooks.make.tapAsync('SingleEntryPlugin', (compilation, callback) => {
            const { entry, name, context } = this;

            // const dep = SingleEntryPlugin.createDependency(entry, name);
            compilation.addEntry(context, entry, name, callback);
        });
    }
}

module.exports = SingleEntryPlugin;
