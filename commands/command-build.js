var File = require('raptor/files/File');
var files = require('raptor/files');
var path = require('path');
var resources = require('raptor/resources');
var cwd = process.cwd();

module.exports = {
    usage: 'Usage: $0 build',

    options: {
        'dev': {
            type: 'boolean',
            describe: 'Development mode'
        },
        'prod': {
            type: 'boolean',
            describe: 'Production mode'
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

        var environment = 'production';

        if (args['dev'] === true) {
            environment = 'development';
        }

        return {
            environment: environment
        };
    },

    run: function(args, config, rapido) {

        var logger = require('raptor/logging').logger('build');
        var environment = args.environment;


        function onError(e) {
            logger.error(e);
        }

        try
        {
            var blogConfigFile = config['blog-config.file'];
            if (!blogConfigFile) {
                blogConfigFile = path.join(cwd, 'blog.json');
            }

            if (!blogConfigFile.exists()) {
                throw new Error('Blog JSON file not found at path "' + blogConfigFile.getAbsolutePath() + '"');
            }

            var blogProperties = JSON.parse(blogConfigFile.readAsString());
            var postsDir = path.resolve(cwd, blogProperties['postsDir'] || 'posts');
            var optimizerConfigPath = path.resolve(cwd, blogProperties['optimizerConfigFile'] || "optimizer-config.xml");

            if (files.exists(optimizerConfigPath)) {
                require('raptor/optimizer').configure(
                    optimizerConfigPath, 
                    {
                        profile: environment
                    });
            }

            function addSearchPathDir(path) {
                if (files.exists(path)) {
                    resources.addSearchPathDir(path);
                }
            }

            addSearchPathDir(path.join(__dirname, 'raptor_modules'));
            addSearchPathDir(cwd);
            addSearchPathDir(path.join(cwd, 'modules'));
            addSearchPathDir(path.join(cwd, 'raptor_modules'));

            require('raptor/templating/compiler').setWorkDir(path.join(cwd, "work"));
            
            var outputDir = blogProperties['outputDir'] || 'build';
            outputDir = path.resolve(cwd, outputDir);

            require('velociblog').create()
                .postsDir(postsDir)
                .theme(blogProperties.theme || 'default')
                .properties(blogProperties)
                .includeFilenamesInUrls(environment === 'development')
                .afterPostWritten(function(eventArgs) {
                    var outputFile = eventArgs.outputFile;
                    rapido.log.info('Blog post written to "' + outputFile.getAbsolutePath() + '"');
                })
                .generate(outputDir)
                .then(
                    function() {
                        rapido.log.info("Blog generated");
                    },
                    function(e) {
                        onError(e);
                    });
        }
        catch(e) {
            onError(e);
        }
    }
}