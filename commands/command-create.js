var File = require('raptor/files/File'),
    files = require('raptor/files'),
    path = require('path');

module.exports = {
    usage: 'Usage: $0 create [blog-name]',

    options: {
        'overwrite': {
            type: 'boolean'
            describe: 'Overwrite existing files'
        }
    },

    validate: function(args, rapido) {
        var name = args._[0];

        if (!name) {
            outputDir = new File(process.cwd());
            name = new File(process.cwd()).getName();
        }
        else {
            outputDir = path.join(process.cwd(), name);
        }

        return {
            name: name,
            overwrite: args['overwrite'] === true
        };
    },

    run: function(args, config, rapido) {
        var outputDir = args.outputDir,
            overwrite = args.overwrite;

        rapido.scaffold(
            {
                scaffoldDirProperty: "scaffold.blog.dir",
                outputDir: args.outputDir,
                overwrite: true,
                data: {
                    blogName: args.name
                },
                afterFile: function(outputFile) {
                    
                },
                beforeFile: function(outputFile, content) {
                    if (outputFile.exists()) {
                        if (outputFile.getName() === rapido.configFilename) {
                            // File already exists... we need to merge
                            var newConfig = JSON.parse(content);
                            rapido.updateConfig(outputFile, newConfig);
                            rapido.log.success('update', outputFile.getAbsolutePath());
                            return false;
                        }
                        return overwrite;
                    }

                    return true;
                }
            });
        rapido.log.success('finished', 'Blog written to "' + outputDir + '"');
        rapido.log('To build your blog use the following command');
        rapido.log.info('raptor-blog build');
        rapido.log('\nTo create a new post using the following command:');
        rapido.log.info('raptor-blog create post');
    }
}