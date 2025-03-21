import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { Context } from '../types.js';
import { color, Listr, ListrDefaultRendererLogLevels } from 'listr2';
import auth from '../tasks/auth.js';
import ctxInit from '../lib/ctx.js';
import getGitInfo from '../tasks/getGitInfo.js';
import createBuild from '../tasks/createBuild.js';
import uploadScreenshots from '../tasks/uploadScreenshots.js';
import finalizeBuild from '../tasks/finalizeBuild.js';
import constants from '../lib/constants.js';

const command = new Command();

command
    .name('upload')
    .description('Upload screenshots from given directory')
    .argument('<directory>', 'Path of the directory')
    .option('-R, --ignoreResolutions', 'Ignore resolution')
    .option('-F, --files <extensions>', 'Comma-separated list of allowed file extensions', val => {
        return val.split(',').map(ext => ext.trim().toLowerCase());
    })
    .option('-E, --removeExtensions', 'Strips file extensions from snapshot names')
    .option('-i, --ignoreDir <patterns>', 'Comma-separated list of directories to ignore', val => {
        return val.split(',').map(pattern => pattern.trim());
    })
    .option('--fetch-results [filename]', 'Fetch results and optionally specify an output file, e.g., <filename>.json')
    .option('--buildName <string>', 'Specify the build name')
    .action(async function(directory, _, command) {
        const options = command.optsWithGlobals();
        if (options.buildName === '') {
            console.log(`Error: The '--buildName' option cannot be an empty string.`);
            process.exit(1);
        }
        let ctx: Context = ctxInit(command.optsWithGlobals());
        ctx.isSnapshotCaptured = true

        if (!fs.existsSync(directory)) {
            console.log(`Error: The provided directory ${directory} not found.`);
            return;
        }

        if (path.extname(directory).toLowerCase() === constants.FILE_EXTENSION_ZIP) {
            ctx.log.debug(`Error: The provided directory ${directory} is a zip file. Zips are not accepted.`);
            return;
        }
        ctx.uploadFilePath = directory;

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                getGitInfo(ctx),
                createBuild(ctx),
                uploadScreenshots(ctx),
                finalizeBuild(ctx)
            ],
            {
                rendererOptions: {
                    icon: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: `→`
                    },
                    color: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: color.gray
                    }
                }
            }
        );

        try {
            await tasks.run(ctx);
        } catch (error) {
            console.log('\nRefer docs: https://www.lambdatest.com/support/docs/smart-visual-regression-testing/');
        }

    });

export default command;
