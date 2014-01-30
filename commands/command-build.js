var File = require('raptor/files/File');
var files = require('raptor/files');
var path = require('path');
var resources = require('raptor/resources');
var cwd = process.cwd();


 function rmdir(dirPath) {
    var files = fs.readdirSync(dirPath);
    if (files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            var filePath = dirPath + '/' + files[i];
            if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            }
            else {
                rmdir(filePath);
            }
        }
    }

    fs.rmdirSync(dirPath);
}

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
        },
        'watch': {
            type: 'boolean',
            describe: 'Watch for changes'
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
            environment: environment,
            watchEnabled: args.watch === true
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
            var optimizerConfigPath = path.resolve(cwd, blogProperties['optimizerConfigFile'] || "config/optimizer-config.xml");

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
            var velociblog = require('velociblog');
            addSearchPathDir(cwd);

            require('raptor/templating/compiler').setWorkDir(path.join(cwd, "work"));

            var outputDir = blogProperties['outputDir'] || 'build';
            outputDir = path.resolve(cwd, outputDir);

            var watchEnabled = args.watchEnabled;

            function generateBlog() {
                console.log("[velociblog] Generating blog...");

                velociblog.create()
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

            generateBlog();

            var watchPaths = blogProperties.watch;
            if (watchPaths) {
                watchPaths = watchPaths.map(function(watchPath) {
                    return path.resolve(cwd, watchPath);
                });
            }


            if (watchEnabled) {
                var hotReloader = require('raptor-hot-reload').create(require)
                    .loggingEnabled(true)
                    // Uncache all cached Node modules
                    .uncache('*')
                    // By-pass the full reload for certain files
                    .specialReload('*.css', function() {
                        // Do nothing
                    })
                    .specialReload('*.rtld', function() {
                        // Do nothing
                        rmdir(path.join(outputDir, 'static'));
                        generateBlog();
                    })
                    .specialReload('*.rhtml', function() {
                        // Do nothing
                        generateBlog();
                    })
                    // Configure which directories/files to watch:
                    .watch(path.join(cwd, 'config'))
                    .watch(path.join(cwd, 'posts'))
                    .watch(path.join(cwd, 'blog.json'))
                    .watch(watchPaths)
                    // .watchExclude("*.css") //Ignore modifications to certain files

                    // Register a listener for the "beforeReload" event"
                    .beforeReload(function() {

                    })

                    // Register a listener for the "afterReload" event
                    .afterReload(function(eventArgs) {
                        // Re-initialize the application after a full reload
                        generateBlog();
                    })
                    .start(); // Start watching for changes!
            }

        }
        catch(e) {
            onError(e);
        }
    }
}